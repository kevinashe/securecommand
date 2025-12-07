import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RetentionPolicy {
  id: string;
  table_name: string;
  retention_days: number;
  action: 'delete' | 'archive';
  date_column: string;
  archive_to_storage: boolean;
  storage_format: 'json' | 'csv';
}

async function exportToJson(data: any[]): Promise<string> {
  return JSON.stringify(data, null, 2);
}

async function exportToCsv(data: any[]): Promise<string> {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

async function archiveToStorage(
  supabase: any,
  tableName: string,
  data: any[],
  format: 'json' | 'csv'
): Promise<{ path: string; size: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime();

  const fileName = `${tableName}_${year}-${month}-${day}_${timestamp}.${format}`;
  const filePath = `${tableName}/${year}/${month}/${fileName}`;

  let fileContent: string;
  let contentType: string;

  if (format === 'csv') {
    fileContent = await exportToCsv(data);
    contentType = 'text/csv';
  } else {
    fileContent = await exportToJson(data);
    contentType = 'application/json';
  }

  const fileBlob = new Blob([fileContent], { type: contentType });
  const fileSize = fileBlob.size;

  const { error: uploadError } = await supabase.storage
    .from('data-archives')
    .upload(filePath, fileBlob, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload archive: ${uploadError.message}`);
  }

  return { path: filePath, size: fileSize };
}

async function processRetentionPolicy(
  supabase: any,
  policy: RetentionPolicy
): Promise<{ count: number; filePath?: string; fileSize?: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

  const { data: oldData, error: fetchError } = await supabase
    .from(policy.table_name)
    .select('*')
    .lt(policy.date_column, cutoffDate.toISOString());

  if (fetchError) {
    throw new Error(`Failed to fetch old data: ${fetchError.message}`);
  }

  if (!oldData || oldData.length === 0) {
    return { count: 0 };
  }

  let filePath: string | undefined;
  let fileSize: number | undefined;

  if (policy.action === 'archive' && policy.archive_to_storage) {
    const archive = await archiveToStorage(
      supabase,
      policy.table_name,
      oldData,
      policy.storage_format
    );
    filePath = archive.path;
    fileSize = archive.size;

    const startDate = oldData.reduce((min: Date, item: any) => {
      const date = new Date(item[policy.date_column]);
      return date < min ? date : min;
    }, new Date(oldData[0][policy.date_column]));

    const endDate = oldData.reduce((max: Date, item: any) => {
      const date = new Date(item[policy.date_column]);
      return date > max ? date : max;
    }, new Date(oldData[0][policy.date_column]));

    await supabase.from('archived_files').insert({
      table_name: policy.table_name,
      file_path: filePath,
      file_size: fileSize,
      record_count: oldData.length,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      format: policy.storage_format,
    });
  }

  const oldIds = oldData.map((item: any) => item.id);
  const { error: deleteError } = await supabase
    .from(policy.table_name)
    .delete()
    .in('id', oldIds);

  if (deleteError) {
    throw new Error(`Failed to delete old data: ${deleteError.message}`);
  }

  await supabase
    .from('data_retention_policies')
    .update({ last_cleanup_at: new Date().toISOString() })
    .eq('id', policy.id);

  return { count: oldData.length, filePath, fileSize };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Super admin access required' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const { data: policies, error: policiesError } = await supabase
      .from('data_retention_policies')
      .select('*')
      .eq('is_enabled', true);

    if (policiesError) {
      throw new Error(`Failed to fetch policies: ${policiesError.message}`);
    }

    const results = [];

    for (const policy of policies as RetentionPolicy[]) {
      try {
        const result = await processRetentionPolicy(supabase, policy);
        results.push({
          table: policy.table_name,
          action: policy.action,
          count: result.count,
          filePath: result.filePath,
          fileSize: result.fileSize,
          status: 'success',
        });
      } catch (error) {
        results.push({
          table: policy.table_name,
          action: policy.action,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data retention cleanup completed',
        processed_at: new Date().toISOString(),
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});