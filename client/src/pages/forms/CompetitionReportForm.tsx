import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import { useNavigate } from 'react-router-dom'; // 👈 FIX: Removed this import
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, CalendarIcon } from 'lucide-react';

// --- UI Components ---
import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";

// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL } from '../../components/ReusableUI';

// --- Helper for combining Tailwind classes ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Zod Schema ---
const CompetitionReportSchema = z.object({
  userId: z.number(),
  reportDate: z.date({ required_error: "A report date is required." }),
  brandName: z.string().min(1, "Brand name is required"),
  billing: z.string().min(1, "Billing is required").regex(/^[0-9.]+$/, "Must be a valid number"),
  nod: z.string().min(1, "NOD is required").regex(/^[0-9]+$/, "Must be a whole number"),
  retail: z.string().min(1, "Retail is required").regex(/^[0-9.]+$/, "Must be a valid number"),
  schemesYesNo: z.enum(['Yes', 'No'], { required_error: "Please select an option." }),
  avgSchemeCost: z.coerce.number().min(0, "Cannot be negative"),
  remarks: z.string().optional(),
});

type CompetitionReportFormValues = z.infer<typeof CompetitionReportSchema>;

// --- Component ---
export default function CompetitionReportForm() {
  // const navigate = useNavigate(); // 👈 FIX: Removed this line
  const { user } = useAppStore();

  const { control, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm<CompetitionReportFormValues>({
    resolver: zodResolver(CompetitionReportSchema),
    mode: 'onChange',
    defaultValues: {
      userId: user?.id,
      reportDate: new Date(),
      brandName: '',
      billing: '',
      nod: '',
      retail: '',
      schemesYesNo: undefined,
      avgSchemeCost: 0,
      remarks: '',
    },
  });

  const submit = async (values: CompetitionReportFormValues) => {
    try {
      const payload = {
        ...values,
        reportDate: format(values.reportDate, 'yyyy-MM-dd'),
        avgSchemeCost: String(values.avgSchemeCost),
        remarks: values.remarks || null,
      };

      const response = await fetch(`${BASE_URL}/api/competition-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to submit report.' }));
        throw new Error(errorData.message || 'An unexpected error occurred.');
      }

      toast.success('Report Submitted', { description: 'Competition report has been saved.' });
      setTimeout(() => window.history.back(), 1500); // 👈 FIX: Changed to window.history.back()

    } catch (error: any) {
      toast.error('Submission Failed', { description: error.message || 'Please try again.' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}> {/* 👈 FIX: Changed to window.history.back() */}
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold ml-2">Competition Report</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-1">New Competition Report</h2>
          <p className="text-sm text-center text-gray-500 mb-6">Log information about competitor activity.</p>

          <form onSubmit={handleSubmit(submit)} className="space-y-6">
            <div className="space-y-1">
              <Label>Report Date *</Label>
              <Controller
                control={control}
                name="reportDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-12",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.reportDate && <p className="text-sm text-red-500 mt-1">{errors.reportDate.message}</p>}
            </div>

            <Controller
              control={control} name="brandName" render={({ field }) => (
                <div className="space-y-1">
                  <Label htmlFor="brandName">Brand Name *</Label>
                  <Input {...field} id="brandName" placeholder="Enter brand name" />
                  {errors.brandName && <p className="text-sm text-red-500 mt-1">{errors.brandName.message}</p>}
                </div>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller control={control} name="billing" render={({ field }) => (
                  <div className="space-y-1">
                    <Label htmlFor="billing">Billing *</Label>
                    <Input {...field} id="billing" placeholder="e.g., 50000.00" type="text" inputMode="decimal" />
                    {errors.billing && <p className="text-sm text-red-500 mt-1">{errors.billing.message}</p>}
                  </div>
                )}
              />
              <Controller control={control} name="nod" render={({ field }) => (
                  <div className="space-y-1">
                    <Label htmlFor="nod">NOD (No. of Dealers) *</Label>
                    <Input {...field} id="nod" placeholder="e.g., 10" type="text" inputMode="numeric" />
                    {errors.nod && <p className="text-sm text-red-500 mt-1">{errors.nod.message}</p>}
                  </div>
                )}
              />
            </div>
            
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Controller control={control} name="retail" render={({ field }) => (
                  <div className="space-y-1">
                    <Label htmlFor="retail">Retail *</Label>
                    <Input {...field} id="retail" placeholder="e.g., 45000.00" type="text" inputMode="decimal" />
                    {errors.retail && <p className="text-sm text-red-500 mt-1">{errors.retail.message}</p>}
                  </div>
                )}
              />
               <Controller control={control} name="schemesYesNo" render={({ field }) => (
                  <div className="space-y-1">
                    <Label>Are schemes active? *</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                       <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Yes">Yes</SelectItem>
                         <SelectItem value="No">No</SelectItem>
                       </SelectContent>
                    </Select>
                    {errors.schemesYesNo && <p className="text-sm text-red-500 mt-1">{errors.schemesYesNo.message}</p>}
                  </div>
                )}
              />
            </div>

            <Controller control={control} name="avgSchemeCost" render={({ field }) => (
                <div className="space-y-1">
                  <Label htmlFor="avgSchemeCost">Average Scheme Cost (₹) *</Label>
                  <Input {...field} id="avgSchemeCost" placeholder="e.g., 1500" type="text" inputMode="numeric" onChange={e => field.onChange(e.target.valueAsNumber)} />
                  {errors.avgSchemeCost && <p className="text-sm text-red-500 mt-1">{errors.avgSchemeCost.message}</p>}
                </div>
              )}
            />

            <Controller control={control} name="remarks" render={({ field }) => (
                <div className="space-y-1">
                  <Label htmlFor="remarks">Remarks (Optional)</Label>
                  <Textarea {...field} value={field.value || ''} id="remarks" placeholder="Add any additional comments" />
                </div>
              )}
            />

            <Button type="submit" className="w-full h-12" disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
              ) : ( "Submit Report" )}
            </Button>
          </form>
        </div>
      </main>
      <Toaster />
    </div>
  );
}