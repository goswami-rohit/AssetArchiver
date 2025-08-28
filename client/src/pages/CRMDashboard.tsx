// src/pages/CRMDashboard.tsx
import React, { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, RefreshCw } from "lucide-react";

import HomePage from "@/pages/HomePage";
import ProfilePage from "@/pages/ProfilePage";
import ChatInterface from "@/pages/ChatInterface";
import JourneyTracker from "@/pages/JourneyTracker";
import { useAppStore } from "@/components/ReusableUI";

/* -------------------- API Hook (trimmed) -------------------- */
const useAPI = () => {
  const { updateLastSync, setData, setLoading, user } = useAppStore.getState();

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        signal: controller.signal,
        ...options,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      updateLastSync();
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }, [updateLastSync]);

  const fetchDashboardStats = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiCall(`/api/dashboard/stats/${user.id}`);
      setData("dashboardStats" as any, data?.data || {});
      setData("userTargets" as any, data?.data?.targets || []);
    } catch (e) {
      console.error("Dashboard stats error:", e);
    }
  }, [user, apiCall, setData]);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        tasks, pjps, dealers, dvr,
        salesReports, collectionReports, dealerBrandMappings,
        ddpReports, leaveApplications, brands
      ] = await Promise.all([
        apiCall(`/api/daily-tasks/user/${user.id}`),
        apiCall(`/api/pjp/user/${user.id}`),
        apiCall(`/api/dealers/user/${user.id}`),
        apiCall(`/api/dvr/user/${user.id}?limit=20`),
        apiCall(`/api/sales-reports/user/${user.id}`),
        apiCall(`/api/collection-reports/user/${user.id}`),
        apiCall(`/api/dealer-brand-mapping/user/${user.id}`),
        apiCall(`/api/ddp/user/${user.id}`),
        apiCall(`/api/leave-applications/user/${user.id}`),
        apiCall(`/api/brands`),
      ]);

      setData("dailyTasks", tasks?.data ?? []);
      setData("pjps", pjps?.data ?? []);
      setData("dealers", dealers?.data ?? []);
      setData("reports", dvr?.data ?? []);
      setData("salesReports", salesReports?.data ?? []);
      setData("collectionReports", collectionReports?.data ?? []);
      setData("dealerBrandMappings", dealerBrandMappings?.data ?? []);
      setData("ddpReports", ddpReports?.data ?? []);
      setData("leaveApplications", leaveApplications?.data ?? []);
      setData("brands", brands?.data ?? []);

      await fetchDashboardStats();
    } catch (e) {
      console.error("Fetch all data error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, apiCall, setData, setLoading, fetchDashboardStats]);

  const createRecord = useCallback(async (type: string, payload: any) => {
    if (!user) return;
    const endpoints: Record<string, string> = {
      task: "/api/daily-tasks",
      pjp: "/api/pjp",
      dealer: "/api/dealers",
      dvr: "/api/dvr",
      tvr: "/api/tvr",
      "dealer-score": "/api/dealer-reports-scores",
      "sales-report": "/api/sales-reports",
      "collection-report": "/api/collection-reports",
      "dealer-brand-mapping": "/api/dealer-brand-mapping",
      ddp: "/api/ddp",
      "leave-application": "/api/leave-applications",
    };
    const resp = await apiCall(endpoints[type], { method: "POST", body: JSON.stringify({ ...payload, userId: user.id }) });
    if (resp?.success) await fetchAllData();
    return resp;
  }, [user, apiCall, fetchAllData]);

  return { fetchAllData, createRecord };
};

/* -------------------- Main Wrapper (no layout here) -------------------- */
export default function CRMDashboard() {
  const {
    user,
    currentPage,
    showCreateModal,
    createType,
    setUser,
    setCurrentPage,
    resetModals,
  } = useAppStore();

  const { fetchAllData, createRecord } = useAPI();

  // boot user from LS
  useEffect(() => {
    const s = localStorage.getItem("user");
    if (s) setUser(JSON.parse(s));
  }, [setUser]);

  // initial fetch
  useEffect(() => {
    if (user) fetchAllData();
  }, [user, fetchAllData]);

  if (!user) {
    // AppShell provides scroll and padding; we just show a simple card
    return (
      <Card className="w-full max-w-md mx-auto my-12">
        <CardContent className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Please Login</h2>
          <p className="text-muted-foreground">You need to login to access the CRM dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {currentPage === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <HomePage />
          </motion.div>
        )}

        {currentPage === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <ProfilePage />
          </motion.div>
        )}

        {currentPage === "ai" && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <ChatInterface onBack={() => setCurrentPage("home")} />
          </motion.div>
        )}

        {currentPage === "journey" && (
          <motion.div
            key="journey"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <JourneyTracker
              userId={user?.id || 1}
              onBack={() => setCurrentPage("home")}
              onJourneyEnd={() => {
                fetchAllData();
                setCurrentPage("home");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showCreateModal && (
        <CreateModal type={createType} onClose={resetModals} onCreate={createRecord} />
      )}
    </>
  );
}

// --------------------
// Create Modal (unchanged)
// --------------------
function CreateModal({ type, onClose, onCreate }: { 
  type: string; 
  onClose: () => void; 
  onCreate: (type: string, data: any) => Promise<any> 
}) {
  const [form, setForm] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const { pjps, dealers, brands, selectedItem } = useAppStore()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let payload = { ...form }
      
      if (type === "sales-report") {
        payload = {
          date: form.date || new Date().toISOString().split('T')[0],
          monthlyTarget: Number(form.monthlyTarget || 0),
          tillDateAchievement: Number(form.tillDateAchievement || 0),
          yesterdayTarget: Number(form.yesterdayTarget || 0),
          yesterdayAchievement: Number(form.yesterdayAchievement || 0),
          dealerId: form.dealerId,
        }
      }
      
      if (type === "collection-report") {
        payload = {
          dealerId: form.dealerId,
          collectedAmount: Number(form.collectedAmount || 0),
          collectedOnDate: form.collectedOnDate || new Date().toISOString().split('T')[0],
          weeklyTarget: Number(form.weeklyTarget || 0),
          tillDateAchievement: Number(form.tillDateAchievement || 0),
          yesterdayTarget: Number(form.yesterdayTarget || 0),
          yesterdayAchievement: Number(form.yesterdayAchievement || 0),
        }
      }
      
      if (type === "dealer-brand-mapping") {
        payload = {
          dealerId: form.dealerId,
          brandId: Number(form.brandId),
          capacityMT: Number(form.capacityMT || 0),
        }
      }
      
      if (type === "ddp") {
        payload = {
          dealerId: form.dealerId,
          creationDate: form.creationDate || new Date().toISOString().split('T')[0],
          status: form.status || "Active",
          obstacle: form.obstacle || null,
        }
      }
      
      if (type === "leave-application") {
        payload = {
          startDate: form.startDate,
          endDate: form.endDate,
          leaveType: form.leaveType || "Casual",
          reason: form.reason,
          status: "Pending",
        }
      }
      
      // Existing form handlers...
      if (type === "task") {
        payload = {
          taskDate: form.taskDate || new Date().toISOString().slice(0, 10),
          visitType: form.title || form.visitType || "General Task",
          siteName: form.siteName || "",
          description: form.description || "",
          pjpId: form.isPjp ? form.pjpId : null,
        }
      }
      
      if (type === "pjp") {
        payload = {
          planDate: form.plannedDate,
          visitType: form.visitType || "Field Visit",
          siteName: form.location,
          areaToBeVisited: form.area || form.location,
          objective: form.objective || "",
          expectedOutcome: form.expectedOutcome || "",
          status: "planned",
        }
      }
      
      if (type === "dealer") {
        payload = {
          name: form.name,
          type: form.type,
          region: form.region,
          area: form.area,
          phoneNo: form.phoneNo,
          address: form.address,
          totalPotential: Number(form.totalPotential || 0),
          bestPotential: Number(form.bestPotential || 0),
          brandSelling: form.brandSelling || [],
          remarks: form.remarks || null,
        }
      }
      
      if (type === "dvr" || type === "tvr") {
        payload = {
          type: type.toUpperCase(),
          title: form.title || `${type.toUpperCase()} Report`,
          location: form.location || "",
          amount: Number(form.amount || 0),
          description: form.description || "",
          date: form.date || new Date().toISOString().slice(0, 10),
        }
      }

      await onCreate(type, payload)
      onClose()
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const titleMap: Record<string, string> = {
    task: "Create Task",
    pjp: "Create Journey Plan",
    dealer: "Create Dealer",
    dvr: "Create DVR",
    tvr: "Create TVR",
    "dealer-score": "Score Dealer",
    "sales-report": "Create Sales Report",
    "collection-report": "Create Collection Report",
    "dealer-brand-mapping": "Map Brand to Dealer",
    "ddp": "Create DDP",
    "leave-application": "Apply for Leave",
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border bg-card/95 backdrop-blur shadow-xl"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{titleMap[type] || "Create"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="max-h-[70vh]">
          <form onSubmit={submit} className="p-6 space-y-4">
            {/* Sales Report Form */}
            {type === "sales-report" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Report Date">
                  <Input 
                    type="date" 
                    value={form.date || ""} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })} 
                    required 
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly Target (₹)">
                    <Input 
                      type="number" 
                      value={form.monthlyTarget || ""} 
                      onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} 
                      required 
                    />
                  </Field>
                  <Field label="Till Date Achievement (₹)">
                    <Input 
                      type="number" 
                      value={form.tillDateAchievement || ""} 
                      onChange={(e) => setForm({ ...form, tillDateAchievement: e.target.value })} 
                      required 
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Yesterday Target (₹)">
                    <Input 
                      type="number" 
                      value={form.yesterdayTarget || ""} 
                      onChange={(e) => setForm({ ...form, yesterdayTarget: e.target.value })} 
                    />
                  </Field>
                  <Field label="Yesterday Achievement (₹)">
                    <Input 
                      type="number" 
                      value={form.yesterdayAchievement || ""} 
                      onChange={(e) => setForm({ ...form, yesterdayAchievement: e.target.value })} 
                    />
                  </Field>
                </div>
              </>
            )}

            {/* Collection Report Form */}
            {type === "collection-report" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Collected Amount (₹)">
                    <Input 
                      type="number" 
                      value={form.collectedAmount || ""} 
                      onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })} 
                      required 
                    />
                  </Field>
                  <Field label="Collection Date">
                    <Input 
                      type="date" 
                      value={form.collectedOnDate || ""} 
                      onChange={(e) => setForm({ ...form, collectedOnDate: e.target.value })} 
                      required 
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Weekly Target (₹)">
                    <Input 
                      type="number" 
                      value={form.weeklyTarget || ""} 
                      onChange={(e) => setForm({ ...form, weeklyTarget: e.target.value })} 
                    />
                  </Field>
                  <Field label="Till Date Achievement (₹)">
                    <Input 
                      type="number" 
                      value={form.tillDateAchievement || ""} 
                      onChange={(e) => setForm({ ...form, tillDateAchievement: e.target.value })} 
                    />
                  </Field>
                </div>
              </>
            )}

            {/* Dealer Brand Mapping Form */}
            {type === "dealer-brand-mapping" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Brand">
                  <Select value={form.brandId || ""} onValueChange={(v) => setForm({ ...form, brandId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {(brands || []).map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capacity (MT)">
                  <Input 
                    type="number" 
                    step="0.01"
                    value={form.capacityMT || ""} 
                    onChange={(e) => setForm({ ...form, capacityMT: e.target.value })} 
                    required 
                  />
                </Field>
              </>
            )}

            {/* DDP Form */}
            {type === "ddp" && (
              <>
                <Field label="Dealer">
                  <Select value={form.dealerId || ""} onValueChange={(v) => setForm({ ...form, dealerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(dealers || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Creation Date">
                  <Input 
                    type="date" 
                    value={form.creationDate || ""} 
                    onChange={(e) => setForm({ ...form, creationDate: e.target.value })} 
                    required 
                  />
                </Field>
                <Field label="Status">
                  <Select value={form.status || ""} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Obstacle (if any)">
                  <Textarea 
                    value={form.obstacle || ""} 
                    onChange={(e) => setForm({ ...form, obstacle: e.target.value })} 
                    placeholder="Describe any obstacles..." 
                  />
                </Field>
              </>
            )}

            {/* Leave Application Form */}
            {type === "leave-application" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date">
                    <Input 
                      type="date" 
                      value={form.startDate || ""} 
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })} 
                      required 
                    />
                  </Field>
                  <Field label="End Date">
                    <Input 
                      type="date" 
                      value={form.endDate || ""} 
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })} 
                      required 
                    />
                  </Field>
                </div>
                <Field label="Leave Type">
                  <Select value={form.leaveType || ""} onValueChange={(v) => setForm({ ...form, leaveType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Casual">Casual Leave</SelectItem>
                      <SelectItem value="Sick">Sick Leave</SelectItem>
                      <SelectItem value="Emergency">Emergency Leave</SelectItem>
                      <SelectItem value="Planned">Planned Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reason">
                  <Textarea 
                    value={form.reason || ""} 
                    onChange={(e) => setForm({ ...form, reason: e.target.value })} 
                    placeholder="Reason for leave..." 
                    required 
                  />
                </Field>
              </>
            )}

            {/* Existing forms for task, pjp, dealer, etc. */}
            {type === "task" && (
              <>
                <Field label="Task Title">
                  <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </Field>
                <Field label="Description">
                  <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <Field label="Task Date">
                  <Input type="date" value={form.taskDate || ""} onChange={(e) => setForm({ ...form, taskDate: e.target.value })} />
                </Field>
                <Field label="Site/Location">
                  <Input value={form.siteName || ""} onChange={(e) => setForm({ ...form, siteName: e.target.value })} placeholder="e.g. Ahmedabad" />
                </Field>
                <div className="flex items-center gap-2">
                  <Switch checked={!!form.isPjp} onCheckedChange={(v) => setForm({ ...form, isPjp: v })} />
                  <Label>This is a PJP task</Label>
                </div>
                {form.isPjp && (
                  <Field label="Related PJP">
                    <Select value={String(form.pjpId || "")} onValueChange={(v) => setForm({ ...form, pjpId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select PJP" /></SelectTrigger>
                      <SelectContent>
                        {(pjps || []).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.objective}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}

            {type === "pjp" && (
              <>
                <Field label="Objective">
                  <Input value={form.objective || ""} onChange={(e) => setForm({ ...form, objective: e.target.value })} required />
                </Field>
                <Field label="Location">
                  <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City / Site" />
                </Field>
                <Field label="Area to Visit">
                  <Input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </Field>
                <Field label="Planned Date">
                  <Input type="date" value={form.plannedDate || ""} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} required />
                </Field>
                <Field label="Expected Outcome">
                  <Textarea value={form.expectedOutcome || ""} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} />
                </Field>
              </>
            )}

            {type === "dealer" && (
              <>
                <Field label="Dealer Name">
                  <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="Type">
                  <Select value={form.type || ""} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dealer-Best">Dealer-Best</SelectItem>
                      <SelectItem value="Sub-Dealer-Best">Sub Dealer-Best</SelectItem>
                      <SelectItem value="Dealer-Non-Best">Dealer-Non Best</SelectItem>
                      <SelectItem value="Sub-Dealer-Non-Best">Sub Dealer-Non Best</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Phone Number">
                  <Input value={form.phoneNo || ""} onChange={(e) => setForm({ ...form, phoneNo: e.target.value })} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Region">
                    <Input value={form.region || ""} onChange={(e) => setForm({ ...form, region: e.target.value })} required />
                  </Field>
                  <Field label="Area">
                    <Input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} required />
                  </Field>
                </div>
                <Field label="Full Address">
                  <Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} required rows={2} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Potential (₹)">
                    <Input type="number" value={form.totalPotential || ""} onChange={(e) => setForm({ ...form, totalPotential: e.target.value })} />
                  </Field>
                  <Field label="Best Potential (₹)">
                    <Input type="number" value={form.bestPotential || ""} onChange={(e) => setForm({ ...form, bestPotential: e.target.value })} />
                  </Field>
                </div>
              </>
            )}

            {(type === "dvr" || type === "tvr") && (
              <>
                <Field label="Title">
                  <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field>
                <Field label="Location">
                  <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (₹)">
                    <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Description">
                  <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-[100px]">
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}
