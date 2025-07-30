import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Search, User, Clock, CheckCircle, XCircle, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function VendorsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("all"); // "all", "pending", "active"
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Employee queries
  const { data: joinRequests, isLoading: joinRequestsLoading } = useQuery({
    queryKey: ["/api/join-requests"],
    refetchInterval: 30000,
  });

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const isLoading = joinRequestsLoading || employeesLoading;
  const safeJoinRequests = joinRequests || [];
  const safeEmployees = employees || [];

  // Employee mutations
  const approveEmployeeMutation = useMutation({
    mutationFn: ({ joinRequestId, approvedBy }: { joinRequestId: number; approvedBy: string }) => 
      apiRequest("POST", "/api/approve-employee", { joinRequestId, approvedBy }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ 
        title: "Employee Approved!", 
        description: `Employee ID: ${data.empId} has been sent to the user.` 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to approve employee", 
        variant: "destructive" 
      });
    }
  });

  const rejectEmployeeMutation = useMutation({
    mutationFn: (joinRequestId: number) => 
      apiRequest("POST", "/api/reject-employee", { joinRequestId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/join-requests"] });
      toast({ title: "Employee Rejected", description: "Registration rejected successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject employee", variant: "destructive" });
    }
  });

  // Filter logic
  const filteredEmployees = safeEmployees.filter((employee: any) => {
    const matchesSearch = employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone?.includes(searchTerm) || false;
    const matchesStatus = !statusFilter || statusFilter === "all" ||
      (statusFilter === "active" && employee.status === "active") ||
      (statusFilter === "inactive" && employee.status !== "active");

    return matchesSearch && matchesStatus;
  });

  const pendingRequests = safeJoinRequests.filter((req: any) => req.status === 'pending');

  const handleApprove = (request: any) => {
    approveEmployeeMutation.mutate({ 
      joinRequestId: request.id, 
      approvedBy: "Admin"
    });
  };

  const handleReject = (request: any) => {
    rejectEmployeeMutation.mutate(request.id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-500" />
            Employee Management
          </CardTitle>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* View Mode Tabs */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-4">
            <Button
              variant={viewMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("all")}
            >
              All Employees
            </Button>
            <Button
              variant={viewMode === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("pending")}
              className="relative"
            >
              <Clock className="w-4 h-4 mr-1" />
              Pending Approvals
              {pendingRequests.length > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </Button>
            <Button
              variant={viewMode === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("active")}
            >
              <UserCheck className="w-4 h-4 mr-1" />
              Active Employees
            </Button>
          </div>
        </div>

        {/* Pending Approvals Section */}
        {viewMode === "pending" && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Registration Requests</h3>
              <p className="text-sm text-slate-600">Review and approve employee registration requests</p>
            </div>
            
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No pending approvals</p>
                <p className="text-sm text-slate-400">All registration requests have been processed</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request: any) => (
                  <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{request.name}</h4>
                            <p className="text-sm text-slate-600">📱 {request.phone}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Telegram ID:</span>
                            <span className="ml-2 font-medium">{request.telegram_id}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Applied:</span>
                            <span className="ml-2 font-medium">
                              {new Date(request.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {request.request_message && (
                          <div className="mt-3 p-3 bg-slate-50 rounded">
                            <p className="text-sm text-slate-700">
                              <strong>Message:</strong> {request.request_message}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Approve Employee Registration</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will create an employee account for <strong>{request.name}</strong> and send them their Employee ID and password via Telegram.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleApprove(request)}
                                className="bg-green-600"
                                disabled={approveEmployeeMutation.isPending}
                              >
                                {approveEmployeeMutation.isPending ? "Approving..." : "Approve Employee"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reject Employee Registration</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will reject <strong>{request.name}</strong>'s registration request. This action can be undone later if needed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleReject(request)}
                                className="bg-red-600"
                                disabled={rejectEmployeeMutation.isPending}
                              >
                                {rejectEmployeeMutation.isPending ? "Rejecting..." : "Reject Request"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Employees Section */}
        {viewMode === "active" && (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Active Employees</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {[
                  "⏰ Morning Attendance", "👤 Punch In/Out + Selfie", "📍 Live GPS Tracking", "📝 Leave Application",
                  "🚗 Distance Tracking", "📊 Reports Download", "🏪 Dealer Management", "🏷️ Dealer Tagging",
                  "📋 Absent List", "🎯 Target vs Achievement", "💰 Expense Submission", "🌐 Geo-fencing",
                  "🔔 Push Notifications", "🏆 Performance Dashboard"
                ].map((feature) => (
                  <div key={feature} className="text-xs bg-blue-50 px-2 py-1 rounded border text-blue-700">
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No active employees yet</p>
                <p className="text-sm text-slate-400">Approved employees will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">EMP ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredEmployees.map((employee: any) => (
                      <tr key={employee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                              <User className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{employee.name}</p>
                              <p className="text-sm text-slate-500">{employee.role || 'Employee'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <code className="bg-slate-100 px-2 py-1 rounded text-sm">{employee.emp_id}</code>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm">{employee.phone}</p>
                          <p className="text-xs text-slate-500">{employee.telegram_id}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {employee.status || 'active'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Button size="sm" variant="outline">
                            View Profile
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All Employees Overview */}
        {viewMode === "all" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Total Employees</p>
                      <p className="text-2xl font-bold text-blue-900">{safeEmployees.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">Pending Requests</p>
                      <p className="text-2xl font-bold text-orange-900">{pendingRequests.length}</p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Active Today</p>
                      <p className="text-2xl font-bold text-green-900">
                        {safeEmployees.filter((emp: any) => emp.status === 'active').length}
                      </p>
                    </div>
                    <UserCheck className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="text-center">
              <p className="text-slate-600 mb-4">Select a view above to manage employees</p>
              <div className="flex justify-center space-x-4">
                <Button onClick={() => setViewMode("pending")} variant="outline">
                  Review Pending Requests
                </Button>
                <Button onClick={() => setViewMode("active")} variant="outline">
                  Manage Active Employees
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}