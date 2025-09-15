import React, { useState, useEffect, useCallback } from 'react';
import type { SubmitHandler, Resolver } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLocation } from "wouter";

// Shadcn UI Components
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";

// Lucide React Icons
import {
  CalendarIcon,
  ChevronsUpDown,
  Search,
  ArrowLeft,
  Loader2
} from "lucide-react";

// Reusable Constants & State Management
import { useAppStore, PJP_STATUS, BASE_URL } from '../../components/ReusableUI';

// --- Zod Schema ---
const PJPSchema = z.object({
  userId: z.number().optional(),
  createdById: z.number().optional(),
  planDate: z.date({
    required_error: "Plan date is required.",
  }),
  areaToBeVisited: z.string().min(1, "Destination dealer is required"),
  description: z.string().optional(),
  status: z.enum(PJP_STATUS, {
    required_error: "Status is required.",
  }),
});

type PJPFormValues = z.infer<typeof PJPSchema>;

interface Dealer {
  name: string;
  address: string;
}

// --- Component ---
export default function AddPJPForm() {
  const [, navigate] = useLocation();
  const { user } = useAppStore();

  const [dealerModalVisible, setDealerModalVisible] = useState(false);
  const [dealersData, setDealersData] = useState<Dealer[]>([]);
  const [isDealersLoading, setIsDealersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const abortControllerRef = React.useRef(new AbortController());

  useEffect(() => {
    const fetchDealers = async () => {
      if (!user?.id) {
        setIsDealersLoading(false);
        return;
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        setIsDealersLoading(true);
        const response = await fetch(`${BASE_URL}/api/dealers/user/${user.id}`, { signal });
        const result = await response.json();

        if (response.ok && result.success) {
          setDealersData(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch dealers');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Fetch aborted');
          return;
        }
        console.error('Failed to fetch dealers:', err.message);
        toast.error('Data Fetch Failed', { description: 'Could not load dealer list.' });
      } finally {
        setIsDealersLoading(false);
      }
    };

    fetchDealers();

    return () => {
      abortControllerRef.current.abort();
    };
  }, [user?.id]);

  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting, isValid } } = useForm<PJPFormValues>({
    resolver: zodResolver(PJPSchema) as unknown as Resolver<PJPFormValues, any>,
    mode: 'onChange',
    // FIX: Set a default value that passes validation to make the button clickable
    defaultValues: {
      userId: user?.id,
      createdById: user?.id,
      planDate: new Date(),
      areaToBeVisited: ' ', // Changed from '' to ' '
      description: '',
      status: 'planned',
    },
  });

  const planDate = watch('planDate');
  const selectedDealerName = watch('areaToBeVisited');
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const filteredDealers = dealersData.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const submit: SubmitHandler<PJPFormValues> = async (values) => {
    try {
      const payload = {
        ...values,
        planDate: values.planDate.toISOString().slice(0, 10),
      };

      const response = await fetch(`${BASE_URL}/api/pjp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create PJP');

      toast.success('PJP Created', {
        description: 'The new journey plan has been saved.'
      });
      setTimeout(() => navigate('/crm'), 1500);
    } catch (error: any) {
      toast.error('Submission Failed', {
        description: error.message
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold ml-2">Plan New Journey (PJP)</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-1">Journey Details</h2>
          <p className="text-sm text-center text-gray-500 mb-6">Plan a visit for yourself.</p>

          {/* ADDED: padding-bottom to the form container to ensure content is visible */}
          <form onSubmit={handleSubmit(submit)} className="space-y-6 pb-28">
            <div className="space-y-1">
              <Label htmlFor="salesperson">Salesperson</Label>
              <Input id="salesperson" value={fullName} disabled />
            </div>

            <div className="space-y-1">
              <Label htmlFor="planDate">Plan Date *</Label>
              <Controller
                control={control}
                name="planDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={`w-full justify-between h-12 font-normal ${!field.value && "text-muted-foreground"}`}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
              {errors.planDate && <p className="text-sm text-red-500 mt-1">{errors.planDate.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="areaToBeVisited">Select Destination Dealer *</Label>
              <Dialog open={dealerModalVisible} onOpenChange={setDealerModalVisible}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12">
                    {selectedDealerName || "Select Destination Dealer"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Select Destination Dealer</DialogTitle>
                  </DialogHeader>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search dealers..."
                      className="pl-8 mb-4"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="h-[200px] overflow-y-auto">
                    {isDealersLoading ? (
                      <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredDealers.length > 0 ? (
                          filteredDealers.map(d => (
                            <Button
                              key={d.name} // Using name as key, assuming it's unique
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => {
                                setValue('areaToBeVisited', `${d.name} - ${d.address || ''}`, { shouldValidate: true });
                                setDealerModalVisible(false);
                                setSearchQuery('');
                              }}
                            >
                              {d.name} - {d.address || ''}
                            </Button>
                          ))
                        ) : (
                          <p className="text-center text-sm text-gray-500">No dealers found.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setDealerModalVisible(false)}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {errors.areaToBeVisited && <p className="text-sm text-red-500 mt-1">{errors.areaToBeVisited.message}</p>}
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Controller
                control={control}
                name="description"
                render={({ field: { value, ...field } }) => (
                  <textarea
                    {...field}
                    placeholder="Description (Optional)"
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={value || ''}
                  />
                )}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field: { onChange, value } }) => (
                  <Select onValueChange={onChange} value={value}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PJP_STATUS.map(s => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && <p className="text-sm text-red-500 mt-1">{errors.status.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? "Saving..." : "Save Journey Plan"}
            </Button>
          </form>
        </div>
      </main>
      <Toaster />
    </div>
  );
}