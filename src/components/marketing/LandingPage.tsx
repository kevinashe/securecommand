import React from 'react';
import { Shield, ArrowRight, Check, Star } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-6">
              <Star className="h-4 w-4 text-blue-400" />
              <span className="text-blue-300 text-sm font-medium">Trusted by Security Professionals Worldwide</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Professional Solutions
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Built for Excellence
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              Comprehensive software solutions designed to streamline operations, enhance productivity,
              and drive success across multiple industries.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => onNavigate('products')}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/30"
              >
                <span>Explore Our Products</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                onClick={() => onNavigate('contact')}
                className="w-full sm:w-auto px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold hover:bg-white/20 transition-all border border-white/20"
              >
                Schedule a Demo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            {[
              { value: '10,000+', label: 'Active Users' },
              { value: '99.9%', label: 'Uptime SLA' },
              { value: '24/7', label: 'Support Available' }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Us?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Industry-leading features that set us apart from the competition
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'Enterprise-Grade Security',
                description: 'Bank-level encryption and security protocols to keep your data safe and compliant.',
                icon: Shield
              },
              {
                title: 'Scalable Architecture',
                description: 'Grow from 10 to 10,000 users without missing a beat. Built to scale with you.',
                icon: ArrowRight
              },
              {
                title: 'Real-Time Updates',
                description: 'Instant synchronization across all devices and users for seamless collaboration.',
                icon: Check
              },
              {
                title: 'Custom Integrations',
                description: 'API access and webhooks to integrate with your existing tools and workflows.',
                icon: Shield
              },
              {
                title: 'Advanced Analytics',
                description: 'Powerful insights and reporting to make data-driven decisions.',
                icon: ArrowRight
              },
              {
                title: 'Expert Support',
                description: 'Dedicated support team available 24/7 to help you succeed.',
                icon: Check
              }
            ].map((feature, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-12 text-center shadow-2xl">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers who trust our solutions for their business needs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => onNavigate('products')}
                className="w-full sm:w-auto px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-lg"
              >
                View All Products
              </button>
              <button
                onClick={() => onNavigate('pricing')}
                className="w-full sm:w-auto px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold hover:bg-white/20 transition-all border border-white/20"
              >
                See Pricing
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Don't just take our word for it. Here's what industry leaders have to say about our solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "SecureCommand transformed how we manage our security operations. The real-time tracking and incident reporting features are game-changers.",
                author: "Michael Rodriguez",
                role: "Operations Director",
                company: "Metro Security Services",
                rating: 5
              },
              {
                quote: "The best investment we've made for our business. Support is outstanding and the platform is incredibly intuitive to use.",
                author: "Sarah Chen",
                role: "CEO",
                company: "Guardian Protection Group",
                rating: 5
              },
              {
                quote: "We've seen a 40% increase in operational efficiency since implementing this system. The analytics alone are worth it.",
                author: "James Patterson",
                role: "VP of Operations",
                company: "Elite Security Solutions",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm text-gray-500">{testimonial.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about our platform
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                question: "How quickly can I get started?",
                answer: "You can be up and running in less than 15 minutes. Our onboarding wizard guides you through company setup, adding sites, and creating user accounts. No technical expertise required."
              },
              {
                question: "What kind of support do you offer?",
                answer: "We provide 24/7 customer support via email, phone, and live chat. All plans include access to our comprehensive knowledge base, video tutorials, and dedicated customer success manager for enterprise clients."
              },
              {
                question: "Is my data secure?",
                answer: "Absolutely. We use bank-level encryption, maintain SOC 2 Type II compliance, and follow strict security protocols. Your data is stored in secure, geo-redundant data centers with automatic backups."
              },
              {
                question: "Can I integrate with other tools?",
                answer: "Yes! We offer REST API access, webhooks, and pre-built integrations with popular tools. Our technical team can help with custom integrations for enterprise clients."
              },
              {
                question: "What if I need to cancel?",
                answer: "You can cancel anytime with no penalties or fees. We offer a 30-day money-back guarantee on annual plans. Your data remains accessible for 90 days after cancellation for easy export."
              },
              {
                question: "Do you offer training for my team?",
                answer: "Yes! We provide comprehensive onboarding training, regular webinars, and can arrange custom training sessions for your team. All training materials are included at no extra cost."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-slate-50 rounded-lg p-6 hover:bg-slate-100 transition-colors">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Still have questions?</p>
            <button
              onClick={() => onNavigate('contact')}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Contact Our Team
            </button>
          </div>
        </div>
      </div>

      <div className="relative bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Trusted by Industry Leaders
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Our software solutions power operations for companies ranging from small businesses
                to Fortune 500 enterprises. Experience the difference that professional-grade tools
                can make for your organization.
              </p>
              <ul className="space-y-4">
                {[
                  'ISO 27001 Certified Infrastructure',
                  'SOC 2 Type II Compliant',
                  'GDPR and CCPA Ready',
                  '99.9% Guaranteed Uptime'
                ].map((item, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-gray-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-12 flex items-center justify-center">
              <div className="text-center">
                <Shield className="h-32 w-32 text-slate-400 mx-auto mb-6" />
                <p className="text-slate-600 text-lg">Enterprise-Grade Platform</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
