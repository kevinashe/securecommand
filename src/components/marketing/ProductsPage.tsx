import React from 'react';
import { Shield, ArrowRight, Check, Users, MapPin, Calendar, TrendingUp } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: any;
  features: string[];
  category: string;
  status: 'available' | 'coming_soon';
  appRoute?: string;
}

interface ProductsPageProps {
  onNavigate: (page: string, productId?: string) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ onNavigate }) => {
  const products: Product[] = [
    {
      id: 'securecommand',
      name: 'SecureCommand',
      tagline: 'Complete Security Management Platform',
      description: 'Comprehensive platform for managing security operations, guards, shifts, incidents, and patrol routes. Real-time GPS tracking, SOS alerts, and advanced analytics.',
      icon: Shield,
      category: 'Security & Safety',
      status: 'available',
      appRoute: '/app',
      features: [
        'Guard & Shift Management',
        'Real-time GPS Tracking',
        'Incident Reporting',
        'Patrol Route Management',
        'SOS Alert System',
        'Equipment Tracking',
        'Advanced Analytics',
        'Mobile Check-ins'
      ]
    },
    {
      id: 'workforce-pro',
      name: 'WorkForce Pro',
      tagline: 'Enterprise Workforce Management',
      description: 'Streamline your workforce operations with advanced scheduling, time tracking, payroll integration, and performance management tools.',
      icon: Users,
      category: 'Human Resources',
      status: 'coming_soon',
      features: [
        'Employee Scheduling',
        'Time & Attendance',
        'Payroll Integration',
        'Performance Reviews',
        'Leave Management',
        'Compliance Tracking',
        'Mobile App Access',
        'Analytics Dashboard'
      ]
    },
    {
      id: 'site-command',
      name: 'SiteCommand',
      tagline: 'Construction Site Management',
      description: 'End-to-end construction project management with site tracking, equipment management, contractor coordination, and safety compliance.',
      icon: MapPin,
      category: 'Construction',
      status: 'coming_soon',
      features: [
        'Project Management',
        'Site Documentation',
        'Equipment Tracking',
        'Contractor Management',
        'Safety Inspections',
        'Progress Reporting',
        'Budget Tracking',
        'Document Management'
      ]
    },
    {
      id: 'event-master',
      name: 'EventMaster',
      tagline: 'Professional Event Management',
      description: 'Plan, organize, and execute flawless events with comprehensive tools for vendors, attendees, schedules, and real-time coordination.',
      icon: Calendar,
      category: 'Events & Hospitality',
      status: 'coming_soon',
      features: [
        'Event Planning',
        'Vendor Management',
        'Attendee Registration',
        'Schedule Management',
        'Ticketing System',
        'Resource Allocation',
        'Live Updates',
        'Post-Event Analytics'
      ]
    },
    {
      id: 'sales-flow',
      name: 'SalesFlow',
      tagline: 'Sales Pipeline Management',
      description: 'Optimize your sales process with lead tracking, pipeline management, automated workflows, and powerful analytics.',
      icon: TrendingUp,
      category: 'Sales & CRM',
      status: 'coming_soon',
      features: [
        'Lead Management',
        'Pipeline Tracking',
        'Sales Automation',
        'Email Integration',
        'Quote Generation',
        'Performance Metrics',
        'Team Collaboration',
        'Forecasting Tools'
      ]
    }
  ];

  const handleProductClick = (product: Product) => {
    if (product.status === 'available' && product.appRoute) {
      onNavigate('login', product.id);
    } else {
      onNavigate('contact', product.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Our Products</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Professional software solutions tailored for different industries and business needs.
            Each product is designed with excellence and built to scale.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {products.map((product) => {
            const IconComponent = product.icon;
            const isAvailable = product.status === 'available';

            return (
              <div
                key={product.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-xl ${
                  isAvailable ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="p-8 md:p-12">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-8">
                    <div className="flex-shrink-0 mb-6 lg:mb-0">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                        isAvailable ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                        <IconComponent className="h-10 w-10 text-white" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <h2 className="text-3xl font-bold text-gray-900">{product.name}</h2>
                            {!isAvailable && (
                              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                                Coming Soon
                              </span>
                            )}
                            {isAvailable && (
                              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                Available Now
                              </span>
                            )}
                          </div>
                          <p className="text-lg text-blue-600 font-medium mb-2">{product.tagline}</p>
                          <p className="text-sm text-gray-500 mb-4">{product.category}</p>
                        </div>
                      </div>

                      <p className="text-gray-600 leading-relaxed mb-6 text-lg">
                        {product.description}
                      </p>

                      <div className="mb-6">
                        <h3 className="font-semibold text-gray-900 mb-3">Key Features:</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {product.features.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                <Check className="h-3 w-3 text-green-600" />
                              </div>
                              <span className="text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <button
                          onClick={() => handleProductClick(product)}
                          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                            isAvailable
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/30'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                        >
                          <span>{isAvailable ? 'Get Started' : 'Join Waitlist'}</span>
                          <ArrowRight className="h-5 w-5" />
                        </button>

                        {isAvailable && (
                          <button
                            onClick={() => onNavigate('pricing', product.id)}
                            className="px-6 py-3 bg-white border-2 border-blue-200 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all"
                          >
                            View Pricing
                          </button>
                        )}

                        <button
                          onClick={() => onNavigate('contact', product.id)}
                          className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                        >
                          Schedule Demo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-12 text-center shadow-xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            Need a Custom Solution?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            We can build custom software tailored to your specific business needs.
            Get in touch to discuss your requirements.
          </p>
          <button
            onClick={() => onNavigate('contact')}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-lg"
          >
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
};
