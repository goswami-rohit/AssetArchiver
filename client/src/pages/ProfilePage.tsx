import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Building2,
  FileText,
  LogOut,
  Eye,
  Navigation,
  Award,
  Target,
  Package,
  ClipboardList,
  Clock,
} from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LeaveApplicationForm from "@/pages/forms/LeaveApplicationForm";

import { useAppStore } from "@/components/ReusableUI";
import { StatusBar, StatTile } from "@/components/ReusableUI";

// Tiny local fallback for "Empty"
function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto opacity-40 mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default function ProfilePage() {
  const {
    user,
    reports,
    salesReports,
    collectionReports,
    dealers,
    pjps,
    dailyTasks,
    dashboardStats,
    userTargets,
    setUIState,
    setUser,
  } = useAppStore();

  const [openLeave, setOpenLeave] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("isAuthenticated");
    setUser(null);
  }, [setUser]);

  return (
    <div className="min-h-full flex flex-col">
      <StatusBar />

      <div className="px-6 py-6 pb-32">
        {/* Profile Header */}
        <div className="text-center mb-8">
          <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary/20 shadow-lg">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-2xl font-bold">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold mt-4">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-muted-foreground">{user?.email}</p>
          <Badge className="mt-2" variant="secondary">
            {user?.role ?? "User"}
          </Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatTile
            icon={FileText}
            value={(reports || []).length + (salesReports || []).length + (collectionReports || []).length}
            label="Total Reports"
            tint="text-blue-500"
          />
          <StatTile icon={Building2} value={(dealers || []).length} label="Dealers Managed" tint="text-orange-500" />
          <StatTile icon={Navigation} value={(pjps || []).length} label="Journey Plans" tint="text-purple-500" />
          <StatTile
            icon={CheckCircle}
            value={(dailyTasks || []).filter((t: any) => t.status === "Completed").length}
            label="Completed Tasks"
            tint="text-emerald-500"
          />
        </div>

        {/* Performance Section */}
        <Card className="mb-8 border-0 shadow-sm bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardStats?.attendance && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span>Today's Attendance</span>
                    </div>
                    <Badge variant={dashboardStats.attendance.isPresent ? "default" : "secondary"}>
                      {dashboardStats.attendance.isPresent ? "Present" : "Absent"}
                    </Badge>
                  </div>
                  {dashboardStats.attendance.punchInTime && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Punch In: {new Date(dashboardStats.attendance.punchInTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}

              {(userTargets || []).map((target: any, idx: number) => {
                const progress = Math.min(100, Math.round(((target.current ?? 0) / (target.target || 1)) * 100));
                const barColor =
                  progress >= 80 ? "bg-emerald-500" : progress >= 60 ? "bg-yellow-500" : "bg-red-500";
                const Icon = target.icon || Target;

                return (
                  <div key={`${target.label}-${idx}`} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${target.color || "text-muted-foreground"}`} />
                        <span>{target.label}</span>
                      </div>
                      <span className="font-mono text-xs">
                        {target.current} / {target.target}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full ${barColor}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent PJPs */}
        <Card className="mb-8 border-0 shadow-sm bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-purple-500" />
              Recent Journey Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(pjps || []).slice(0, 5).length ? (
              <div className="space-y-3">
                {(pjps || []).slice(0, 5).map((pjp: any, i: number) => (
                  <div key={pjp.id ?? i} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{pjp.objective}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{pjp.siteName || pjp.location}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {pjp.status}
                          </Badge>
                          {pjp.planDate && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(pjp.planDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setUIState("selectedItem", pjp);
                          setUIState("showDetailModal", true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={Navigation} label="No journey plans yet" />
            )}
          </CardContent>
        </Card>

        {/* Settings & Actions */}
        <div className="space-y-5">
          {/* Apply for Leave */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 rounded-xl border bg-card hover:bg-accent/10"
            onClick={() => setOpenLeave(true)}
          >
            <ClipboardList className="h-5 w-5" />
            Apply for Leave
          </Button>

          {/* Leave Application Dialog */}
          <Dialog modal={false} open={openLeave} onOpenChange={setOpenLeave}>
            <DialogContent className="p-0 w-[100vw] sm:max-w-md h-[90vh] overflow-hidden">
              <DialogHeader className="px-4 pt-4 pb-2">
                <DialogTitle>Apply for Leave</DialogTitle>
              </DialogHeader>
              <div className="h-full overflow-y-auto px-4 pb-4">
                <LeaveApplicationForm
                  userId={user?.id}
                  onSubmitted={() => setOpenLeave(false)}
                  onCancel={() => setOpenLeave(false)}
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Leave Applications show area*/}
          <div className="rounded-xl border bg-card/60 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Your Leave Applications
            </h3>
            <Empty icon={ClipboardList} label="No leave applications yet" />
          </div>

          {/* Brand Mapping */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 rounded-xl border bg-card hover:bg-accent/10"
            onClick={() => {
              setUIState("createType", "dealer-brand-mapping");
              setUIState("showCreateModal", true);
            }}
          >
            <Package className="h-5 w-5" />
            Manage Brand Mapping
          </Button>

          {/* Brand Mapping List show area*/}
          <div className="rounded-xl border bg-card/60 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Dealer-Brand Mapping
            </h3>
            <Empty icon={Package} label="No mappings yet" />
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6">
          <Button
            variant="destructive"
            className="w-full h-12 rounded-xl shadow-sm"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </Button>
        </div>
      </div>

    </div>
  );
}
