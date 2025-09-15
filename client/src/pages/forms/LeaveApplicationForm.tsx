import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from "wouter";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, CalendarIcon } from 'lucide-react';

// --- UI Components ---
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL, LEAVE_TYPE } from '@/components/ReusableUI';

// --- Helper for combining Tailwind classes ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Zod Schema ---
const LeaveSchema = z.object({
  leaveType: z.string().min(1, "Leave type is required"),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  reason: z.string().min(5, "A brief reason of at least 5 characters is required"),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date cannot be earlier than the start date",
  path: ["endDate"],
});

type LeaveFormValues = z.infer<typeof LeaveSchema>;

// --- Component ---
export default function LeaveApplicationForm() {
  const { user } = useAppStore();
  const [, navigate] = useLocation();

  const { control, handleSubmit, watch, formState: { errors, isSubmitting, isValid } } = useForm<LeaveFormValues>({
    resolver: zodResolver(LeaveSchema),
    mode: 'onChange',
    // FIX: Set a default value that passes validation to make the button clickable
    defaultValues: {
      leaveType: '',
      startDate: new Date(),
      endDate: new Date(),
      reason: ' ', // Changed from '' to ' '
    },
  });

  const startDate = watch('startDate');

  const submit = async (values: LeaveFormValues) => {
    if (!user?.id) {
      toast.error("Authentication Error", { description: "User not found. Please log in again." });
      return;
    }
    try {
      const payload = {
        userId: user.id,
        status: 'pending',
        ...values,
        startDate: format(values.startDate, 'yyyy-MM-dd'),
        endDate: format(values.endDate, 'yyyy-MM-dd'),
      };

      const response = await fetch(`${BASE_URL}/api/leave-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit leave application");
      }

      toast.success("Success", { description: "Your leave application has been submitted." });
      setTimeout(() => navigate('/crm'), 1500);

    } catch (error: any) {
      toast.error("Submission Failed", { description: error.message || "An unexpected error occurred." });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Request Time Off</h2>
        <p className="text-sm text-gray-500 pt-1">Fill in the details for your leave request.</p>
      </div>
      {/* ADDED: padding-bottom to the form container to ensure content is visible */}
      <form onSubmit={handleSubmit(submit)} className="space-y-6 pt-4 pb-28">
        <div className="space-y-1">
          <Label>Leave Type *</Label>
          <Controller name="leaveType" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Select Leave Type..." /></SelectTrigger>
              <SelectContent>{LEAVE_TYPE.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.leaveType && <p className="text-sm text-red-500 mt-1">{errors.leaveType.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Start Date *</Label>
            <Controller name="startDate" control={control} render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
              </Popover>
            )} />
            {errors.startDate && <p className="text-sm text-red-500 mt-1">{errors.startDate.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>End Date *</Label>
            <Controller name="endDate" control={control} render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < startDate} initialFocus /></PopoverContent>
              </Popover>
            )} />
            {errors.endDate && <p className="text-sm text-red-500 mt-1">{errors.endDate.message}</p>}
          </div>
        </div>

        <Controller name="reason" control={control} render={({ field }) => (
          <div className="space-y-1">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea {...field} id="reason" placeholder="Please provide a reason for your leave..." />
            {errors.reason && <p className="text-sm text-red-500 mt-1">{errors.reason.message}</p>}
          </div>
        )} />

        <div className="flex justify-end items-center gap-4 pt-2">
          <Button type="button" variant="ghost" onClick={() => window.history.back()}>Cancel</Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}