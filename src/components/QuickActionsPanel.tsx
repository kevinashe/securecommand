import React from 'react';
import { Plus, Settings, Users, Building, FileText, Bell } from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export const QuickActionsPanel: React.FC<QuickActionsProps> = ({ onAction }) => {
  const actions = [
    {
      id: 'create-company',
      label: 'Create Company',
      icon: Building,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'manage-users',
      label: 'Manage Users',
      icon: Users,
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      id: 'view-billing',
      label: 'View Billing',
      icon: FileText,
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'system-settings',
      label: 'System Settings',
      icon: Settings,
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      id: 'send-notification',
      label: 'Send Alert',
      icon: Bell,
      color: 'bg-red-500 hover:bg-red-600',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
        <Plus className="h-5 w-5 text-gray-400" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={`${action.color} text-white p-4 rounded-lg transition-colors flex flex-col items-center gap-2`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium text-center">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
