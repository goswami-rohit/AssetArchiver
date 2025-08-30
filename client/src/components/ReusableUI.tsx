// src/components/ReusableUI.tsx
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { create } from "zustand";

export interface Company { 
    companyName?: string 
}

export interface UserShape {
  id: number
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  company?: Company
  companyId?: number | null
}

export interface AppState {
  user: UserShape | null
  currentPage: "home" | "ai" | "journey" | "profile"
  attendanceStatus: "in" | "out"
  isLoading: boolean
  isOnline: boolean
  lastSync: Date | null

  dailyTasks: any[]
  pjps: any[]
  dealers: any[]
  reports: any[]
  tvrReports: any[]
  salesReports: any[]
  collectionReports: any[]
  clientReports: any[]
  competitionReports: any[]
  dealerBrandMappings: any[]
  ddpReports: any[]
  leaveApplications: any[]
  brands: any[]
  ratings: any[]
  attendanceHistory: any[]
  userTargets: any[]
  dealerScores: any[]
  dashboardStats: {
    todaysTasks: number;
    activePJPs: number;
    totalDealers: number;
    totalReports: number;
  }

  showCreateModal: boolean
  createType: "task" | "pjp" | "dealer" | "dvr" | "tvr" | "dealer-score" | "sales-report" | "collection-report" | "dealer-brand-mapping" | "ddp" | "leave-application"
  selectedItem: any
  showDetailModal: boolean

  setUser: (u: UserShape | null) => void
  setCurrentPage: (p: AppState["currentPage"]) => void
  setAttendanceStatus: (s: AppState["attendanceStatus"]) => void
  setLoading: (b: boolean) => void
  setOnlineStatus: (b: boolean) => void
  updateLastSync: () => void
  setData: (k: string, data: any) => void
  setUIState: (k: string, v: any) => void
  resetModals: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentPage: "home",
  attendanceStatus: "out",
  isLoading: false,
  isOnline: true,
  lastSync: null,

  dailyTasks: [],
  pjps: [],
  dealers: [],
  reports: [],
  tvrReports: [],
  salesReports: [],
  collectionReports: [],
  clientReports: [],
  competitionReports: [],
  dealerBrandMappings: [],
  ddpReports: [],
  leaveApplications: [],
  brands: [],
  ratings: [],
  attendanceHistory: [],
  userTargets: [],
  dealerScores: [],
  dashboardStats: {
    todaysTasks: 0,
    activePJPs: 0,
    totalDealers: 0,
    totalReports: 0
  },

  showCreateModal: false,
  createType: "task",
  selectedItem: null,
  showDetailModal: false,

  setUser: (user) => set({ user }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setAttendanceStatus: (attendanceStatus) => set({ attendanceStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnlineStatus: (isOnline) => set({ isOnline }),
  updateLastSync: () => set({ lastSync: new Date() }),
  setData: (key, data) => set({ [key]: data } as any),
  setUIState: (key, value) => set({ [key]: value } as any),
  resetModals: () => set({ showCreateModal: false, showDetailModal: false, selectedItem: null }),
}))

// --------------------
// Reusable UI Components
// --------------------
export const StatusBar = () => {
  const { isOnline, lastSync } = useAppStore()
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
        <span className="text-xs font-medium text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
      </div>
      {lastSync && (
        <span className="text-xs text-muted-foreground">Last sync: {lastSync.toLocaleTimeString()}</span>
      )}
    </div>
  )
}

export const LoadingList = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <Card key={i} className="bg-card/50 border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
)

export const StatCard = ({ label, value, Icon, gradient }: { label: string; value: number; Icon: any; gradient: string }) => (
  <Card className="bg-card/80 border-0 shadow-sm hover:shadow-md transition-all duration-200">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${gradient} shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

export const StatTile = ({ icon: Icon, value, label, tint }: { icon: any; value: number; label: string; tint: string }) => (
  <Card className="bg-card/60 border-0 shadow-sm">
    <CardContent className="p-4 text-center">
      <Icon className={`h-8 w-8 mx-auto mb-2 ${tint}`} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
)

// Reusable constants in forms
export const DEALER_TYPES = [ "Dealer-Best", "Sub Dealer-Best", "Dealer-Non Best", "Sub Dealer-Non Best",] as const;

export const BRANDS = ["Star", "Amrit", "Dalmia", "Topcem", "Black Tiger", "Surya Gold", "Max", "Taj", "Specify in remarks"];

export const UNITS = ["MT", "KG", "Bags"] as const;

export const REGIONS = ["Kamrup M", "Kamrup", "Karbi Anglong", "Dehmaji"];

export const AREAS = ["Guwahati", "Beltola", "Zoo Road", "Tezpur", "Diphu", "Nagaon", "Barpeta"];