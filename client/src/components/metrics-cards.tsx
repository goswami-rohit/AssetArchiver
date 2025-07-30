import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  User, 
  CheckCircle, 
  Clock, 
  XCircle
} from "lucide-react";

export default function MetricsCards() {
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const { data: joinRequests, isLoading: joinRequestsLoading } = useQuery({
    queryKey: ["/api/join-requests"],
  });

  const isLoading = employeesLoading || joinRequestsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-20 bg-slate-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Employee calculations
  const safeEmployees = employees || [];
  const safeJoinRequests = joinRequests || [];
  
  const totalEmployees = safeEmployees.length;
  const pendingRequests = safeJoinRequests.filter((req: any) => req.status === 'pending').length;
  const activeEmployees = safeEmployees.filter((emp: any) => emp.status === 'active').length;
  
  // For now, we'll show mock data for present/absent since we don't have real attendance data yet
  const presentToday = 0; // Will be calculated from attendance data later
  const onLeave = 0; // Will be calculated from leave applications later
  const absentToday = 0; // Will be calculated from attendance data later

  const metricCards = [
    {
      title: "Total Employees",
      value: totalEmployees.toString(),
      icon: User,
      bgColor: "border-blue-200 bg-blue-50",
      textColor: "text-blue-600",
      valueColor: "text-blue-900"
    },
    {
      title: "Present Today",
      value: presentToday.toString(),
      icon: CheckCircle,
      bgColor: "border-green-200 bg-green-50", 
      textColor: "text-green-600",
      valueColor: "text-green-900"
    },
    {
      title: "On Leave",
      value: onLeave.toString(),
      icon: Clock,
      bgColor: "border-orange-200 bg-orange-50",
      textColor: "text-orange-600", 
      valueColor: "text-orange-900"
    },
    {
      title: "Absent Today",
      value: absentToday.toString(),
      icon: XCircle,
      bgColor: "border-red-200 bg-red-50",
      textColor: "text-red-600",
      valueColor: "text-red-900"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {metricCards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index} className={`shadow-sm ${card.bgColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${card.textColor}`}>{card.title}</p>
                  <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${card.textColor}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}