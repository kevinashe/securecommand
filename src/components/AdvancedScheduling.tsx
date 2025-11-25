import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Wand2, Users, Clock, MapPin, CheckCircle, X, AlertCircle } from 'lucide-react';

interface Guard {
  id: string;
  full_name: string;
  phone: string;
  availability?: any[];
  qualifications?: any[];
}

interface Site {
  id: string;
  name: string;
  address: string;
  requirements?: any[];
}

interface ShiftTemplate {
  id: string;
  name: string;
  site_id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  required_guards: number;
  is_active: boolean;
}

export const AdvancedScheduling: React.FC = () => {
  const { profile } = useAuth();
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [autoAssigning, setAutoAssigning] = useState(false);

  const [templateForm, setTemplateForm] = useState({
    name: '',
    site_id: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    required_guards: 1,
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    try {
      const [guardsRes, sitesRes, templatesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('company_id', profile.company_id!)
          .eq('role', 'security_officer'),

        supabase
          .from('sites')
          .select('*')
          .eq('company_id', profile.company_id!)
          .eq('is_active', true),

        supabase
          .from('shift_templates')
          .select('*')
          .eq('company_id', profile.company_id!)
          .eq('is_active', true),
      ]);

      if (guardsRes.data) {
        const guardsWithDetails = await Promise.all(
          guardsRes.data.map(async (guard) => {
            const [availabilityRes, qualificationsRes] = await Promise.all([
              supabase
                .from('guard_availability')
                .select('*')
                .eq('guard_id', guard.id),

              supabase
                .from('guard_qualifications')
                .select('*')
                .eq('guard_id', guard.id)
                .eq('verified', true),
            ]);

            return {
              ...guard,
              availability: availabilityRes.data || [],
              qualifications: qualificationsRes.data || [],
            };
          })
        );
        setGuards(guardsWithDetails);
      }

      if (sitesRes.data) {
        const sitesWithRequirements = await Promise.all(
          sitesRes.data.map(async (site) => {
            const { data: requirements } = await supabase
              .from('site_requirements')
              .select('*')
              .eq('site_id', site.id);

            return {
              ...site,
              requirements: requirements || [],
            };
          })
        );
        setSites(sitesWithRequirements);
      }

      if (templatesRes.data) setTemplates(templatesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateGuardScore = (
    guard: Guard,
    site: Site,
    startTime: string,
    dayOfWeek: number
  ): number => {
    let score = 100;

    const availability = guard.availability?.find(
      (a: any) => a.day_of_week === dayOfWeek && a.is_available
    );
    if (!availability) return 0;

    const shiftStart = new Date(`2000-01-01T${startTime}`);
    const availStart = new Date(`2000-01-01T${availability.start_time}`);
    const availEnd = new Date(`2000-01-01T${availability.end_time}`);

    if (shiftStart < availStart || shiftStart > availEnd) {
      score -= 50;
    }

    if (site.requirements && site.requirements.length > 0) {
      const guardQualTypes = guard.qualifications?.map((q: any) => q.qualification_type) || [];
      const hasAllRequired = site.requirements.every((req: any) =>
        guardQualTypes.includes(req.required_qualification)
      );
      if (hasAllRequired) score += 20;
      else score -= 30;
    }

    return Math.max(0, score);
  };

  const autoAssignShifts = async () => {
    setAutoAssigning(true);

    try {
      const dayOfWeek = selectedDate.getDay();
      const relevantTemplates = templates.filter(
        (t) => t.day_of_week === null || t.day_of_week === dayOfWeek
      );

      for (const template of relevantTemplates) {
        const site = sites.find((s) => s.id === template.site_id);
        if (!site) continue;

        const { data: existingShifts } = await supabase
          .from('shifts')
          .select('id')
          .eq('site_id', template.site_id)
          .gte('start_time', selectedDate.toISOString())
          .lte('start_time', new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (existingShifts && existingShifts.length >= template.required_guards) {
          continue;
        }

        const guardScores = guards.map((guard) => ({
          guard,
          score: calculateGuardScore(guard, site, template.start_time, dayOfWeek),
        }));

        guardScores.sort((a, b) => b.score - a.score);

        const selectedGuards = guardScores
          .filter((gs) => gs.score > 50)
          .slice(0, template.required_guards);

        for (const { guard } of selectedGuards) {
          const startDateTime = new Date(selectedDate);
          const [hours, minutes] = template.start_time.split(':');
          startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          const endDateTime = new Date(selectedDate);
          const [endHours, endMinutes] = template.end_time.split(':');
          endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

          if (endDateTime < startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
          }

          await supabase.from('shifts').insert({
            site_id: template.site_id,
            guard_id: guard.id,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: 'scheduled',
            notes: `Auto-assigned from template: ${template.name}`,
          });
        }
      }

      alert('Shifts auto-assigned successfully!');
    } catch (error) {
      console.error('Error auto-assigning shifts:', error);
      alert('Error auto-assigning shifts. Please try again.');
    } finally {
      setAutoAssigning(false);
    }
  };

  const createTemplate = async () => {
    try {
      await supabase.from('shift_templates').insert({
        company_id: profile!.company_id,
        name: templateForm.name,
        site_id: templateForm.site_id,
        day_of_week: templateForm.day_of_week ? parseInt(templateForm.day_of_week) : null,
        start_time: templateForm.start_time,
        end_time: templateForm.end_time,
        required_guards: templateForm.required_guards,
        is_active: true,
      });

      setShowTemplateModal(false);
      setTemplateForm({
        name: '',
        site_id: '',
        day_of_week: '',
        start_time: '',
        end_time: '',
        required_guards: 1,
      });
      loadData();
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error creating template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this shift template?')) return;

    try {
      await supabase.from('shift_templates').delete().eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Advanced Scheduling</h2>
          <p className="text-gray-600">Smart shift assignment and templates</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Auto-Assign Shifts</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date for Auto-Assignment
            </label>
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={autoAssignShifts}
            disabled={autoAssigning}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Wand2 className="h-5 w-5" />
            {autoAssigning ? 'Assigning Shifts...' : 'Auto-Assign Shifts'}
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How Auto-Assignment Works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Matches guards based on availability and qualifications</li>
                  <li>Considers site requirements and guard certifications</li>
                  <li>Uses shift templates to determine needed shifts</li>
                  <li>Scores each guard and assigns best matches</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Shift Templates</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {templates.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No shift templates yet. Create one to get started.
            </div>
          ) : (
            templates.map((template) => {
              const site = sites.find((s) => s.id === template.site_id);
              return (
                <div key={template.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                        {site && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {site.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {template.start_time} - {template.end_time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {template.required_guards} {template.required_guards === 1 ? 'guard' : 'guards'}
                        </span>
                        {template.day_of_week !== null && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {dayNames[template.day_of_week]}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Shift Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Morning Security"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                <select
                  value={templateForm.site_id}
                  onChange={(e) => setTemplateForm({ ...templateForm, site_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week (optional)
                </label>
                <select
                  value={templateForm.day_of_week}
                  onChange={(e) => setTemplateForm({ ...templateForm, day_of_week: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any Day</option>
                  {dayNames.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={templateForm.start_time}
                    onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={templateForm.end_time}
                    onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Required Guards
                </label>
                <input
                  type="number"
                  min="1"
                  value={templateForm.required_guards}
                  onChange={(e) => setTemplateForm({ ...templateForm, required_guards: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={createTemplate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Template
                </button>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
