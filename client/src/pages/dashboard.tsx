import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import MetricsCards from "@/components/metrics-cards";
import InquiriesTable from "@/components/inquiries-table";
import VendorsTable from "@/components/vendors-table";
import BotConfig from "@/components/bot-config";
import ApiDocs from "@/components/api-docs";
import { Bell, User, MessageCircle } from "lucide-react";

type TabType = "dashboard" | "inquiries" | "vendors" | "analytics" | "bot-config" | "api";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const { data: whatsappStatus } = useQuery({
    queryKey: ["/api/admin/whatsapp-status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const tabTitles = {
    dashboard: "Dashboard Overview",
    inquiries: "Inquiry Management", 
    vendors: "Vendor Management",
    analytics: "Analytics & Reports",
    "bot-config": "Bot Configuration",
    api: "API Documentation"
  };

  const tabDescriptions = {
    dashboard: "Monitor bot activity and vendor engagement",
    inquiries: "View and manage all price inquiries",
    vendors: "Manage vendor profiles and performance", 
    analytics: "View detailed analytics and insights",
    "bot-config": "Configure bot settings and templates",
    api: "REST API documentation and examples"
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <MetricsCards />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <InquiriesTable limit={5} showHeader={true} title="Recent Inquiries" />
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Cities by Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Mumbai</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full">
                        <div className="w-4/5 h-2 bg-primary rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">421</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Delhi</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full">
                        <div className="w-3/5 h-2 bg-primary rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">312</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Guwahati</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full">
                        <div className="w-2/5 h-2 bg-primary rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">187</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "inquiries":
        return <InquiriesTable />;
      case "vendors":
        return <VendorsTable />;
      case "analytics":
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Analytics Overview</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-4">Material Demand</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">TMT Bars</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full">
                        <div className="w-3/5 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">60%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Cement</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full">
                        <div className="w-2/5 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">40%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-4">Response Time Trends</h4>
                <div className="h-32 bg-slate-50 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                  <p className="text-slate-500 text-sm">Chart visualization would be implemented here</p>
                </div>
              </div>
            </div>
          </div>
        );
      case "bot-config":
        return <BotConfig />;
      case "api":
        return <ApiDocs />;
      default:
        return <MetricsCards />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{tabTitles[activeTab]}</h2>
              <p className="text-sm text-slate-600 mt-1">{tabDescriptions[activeTab]}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* WhatsApp Bot Status */}
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${whatsappStatus?.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-slate-600">
                    WhatsApp {whatsappStatus?.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {whatsappStatus?.activeSessions > 0 && (
                    <span className="text-xs text-slate-500">({whatsappStatus.activeSessions} chats)</span>
                  )}
                </div>
              </div>
              
              {/* General Bot Status */}
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600">System Active</span>
              </div>
              
              {/* Notifications */}
              <button className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
              
              {/* User Profile */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Admin User</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}
