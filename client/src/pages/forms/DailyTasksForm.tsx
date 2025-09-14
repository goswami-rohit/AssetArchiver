import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import { useNavigate } from 'react-router-dom'; // 👈 FIX: Removed this import
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, CalendarIcon, ChevronsUpDown, Check } from 'lucide-react';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";


// --- Custom Hooks & Constants ---
import { useAppStore, BASE_URL, DEALER_TYPES } from '@/components/ReusableUI';

// --- Helper for combining Tailwind classes ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Zod Schema ---
const DailyTaskSchema = z.object({
  userId: z.number(),
  assignedByUserId: z.number(),
  taskDate: z.date({ required_error: "A task date is required." }),
  visitType: z.string().min(1, "Visit type is required"),
  relatedDealerId: z.string().optional().nullable(),
  siteName: z.string().optional(),
  description: z.string().optional(),
  pjpId: z.string().optional().nullable(),
});

type DailyTaskFormValues = z.infer<typeof DailyTaskSchema>;

interface Dealer {
  id: string;
  name: string;
}
interface PJP {
  id: string;
  planDate: string;
}

// --- Component ---
export default function DailyTasksForm() {
  // const navigate = useNavigate(); // 👈 FIX: Removed this line
  const { user } = useAppStore();

  const [dealers, setDealers] = React.useState<Dealer[]>([]);
  const [pjps, setPjps] = React.useState<PJP[]>([]);
  const [isLoading, setIsLoading] = React.useState({ dealers: true, pjps: true });
  const [open, setOpen] = React.useState({ dealers: false, pjps: false });

  React.useEffect(() => {
    const fetchData = async (url: string, setData: (data: any) => void, type: 'dealers' | 'pjps') => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${type}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          toast.error(`Error loading ${type}`, { description: result.message });
        }
      } catch (error: any) {
        toast.error(`Failed to fetch ${type}`, { description: error.message });
      } finally {
        setIsLoading(prev => ({ ...prev, [type]: false }));
      }
    };
    if (user?.id) {
      fetchData(`${BASE_URL}/api/dealers/user/${user.id}`, setDealers, 'dealers');
      fetchData(`${BASE_URL}/api/pjp/user/${user.id}`, setPjps, 'pjps');
    }
  }, [user?.id]);


  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting, isValid } } = useForm<DailyTaskFormValues>({
    resolver: zodResolver(DailyTaskSchema),
    mode: 'onChange',
    defaultValues: {
      userId: user?.id,
      assignedByUserId: user?.id,
      taskDate: new Date(),
      visitType: '',
      relatedDealerId: null,
      siteName: '',
      description: '',
      pjpId: null,
    },
  });

  const selectedDealerId = watch('relatedDealerId');
  const selectedPjpId = watch('pjpId');

  const submit = async (values: DailyTaskFormValues) => {
    try {
      const payload = {
        ...values,
        taskDate: format(values.taskDate, 'yyyy-MM-dd'),
      };

      const response = await fetch(`${BASE_URL}/api/daily-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create task.' }));
        throw new Error(errorData.message || 'An unexpected error occurred.');
      }

      toast.success('Task Created', { description: 'The daily task has been created successfully.' });
      setTimeout(() => window.history.back(), 1500); // 👈 FIX: Changed to window.history.back()

    } catch (error: any) {
      toast.error('Submission Failed', { description: error.message });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button> {/* 👈 FIX: Changed to window.history.back() */}
          <h1 className="text-lg font-bold ml-2">Create Daily Task</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-1">Daily Task Details</h2>
          <p className="text-sm text-center text-gray-500 mb-6">Log your day-to-day work activities.</p>

          <form onSubmit={handleSubmit(submit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Task Date *</Label>
                <Controller name="taskDate" control={control} render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-12", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>
                )} />
                {errors.taskDate && <p className="text-sm text-red-500 mt-1">{errors.taskDate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Visit Type *</Label>
                <Controller name="visitType" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select Visit Type..." /></SelectTrigger>
                    <SelectContent>{DEALER_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                {errors.visitType && <p className="text-sm text-red-500 mt-1">{errors.visitType.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Related Dealer (Optional)</Label>
              <Dialog open={open.dealers} onOpenChange={(isOpen) => setOpen(p => ({ ...p, dealers: isOpen }))}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 font-normal">
                    {selectedDealerId ? dealers.find(d => d.id === selectedDealerId)?.name : "Select a dealer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="p-0">
                  <Command>
                    <CommandInput placeholder="Search for a dealer..." />
                    <CommandList>
                      {isLoading.dealers && <div className="p-4 text-center text-sm">Loading dealers...</div>}
                      <CommandEmpty>No dealer found.</CommandEmpty>
                      <CommandGroup>
                        {dealers.map((dealer) => (
                          <CommandItem key={dealer.id} value={dealer.name} onSelect={() => {
                            setValue("relatedDealerId", dealer.id, { shouldValidate: true });
                            setOpen(p => ({ ...p, dealers: false }));
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedDealerId === dealer.id ? "opacity-100" : "opacity-0")} />
                            {dealer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </div>
            
            <Controller name="siteName" control={control} render={({ field }) => (
              <div className="space-y-1">
                <Label htmlFor="siteName">Site Name (Optional)</Label>
                <Input {...field} value={field.value || ''} id="siteName" placeholder="Enter site name if applicable" />
              </div>
            )} />

            <div className="space-y-1">
              <Label>PJP Reference (Optional)</Label>
               <Dialog open={open.pjps} onOpenChange={(isOpen) => setOpen(p => ({ ...p, pjps: isOpen }))}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 font-normal">
                    {selectedPjpId ? `PJP: ${format(new Date(pjps.find(p => p.id === selectedPjpId)?.planDate || new Date()), 'PPP')}` : "Select a PJP..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="p-0">
                  <Command>
                    <CommandInput placeholder="Search by date..." />
                    <CommandList>
                       {isLoading.pjps && <div className="p-4 text-center text-sm">Loading PJPs...</div>}
                      <CommandEmpty>No PJP found.</CommandEmpty>
                      <CommandGroup>
                        {pjps.map((pjp) => (
                          <CommandItem key={pjp.id} value={pjp.planDate} onSelect={() => {
                            setValue("pjpId", pjp.id, { shouldValidate: true });
                            setOpen(p => ({ ...p, pjps: false }));
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedPjpId === pjp.id ? "opacity-100" : "opacity-0")} />
                            PJP: {format(new Date(pjp.planDate), 'PPP')}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </div>
            
            <Controller name="description" control={control} render={({ field }) => (
              <div className="space-y-1">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea {...field} value={field.value || ''} id="description" placeholder="Add any details about the task..." />
              </div>
            )} />

            <Button type="submit" className="w-full h-12" disabled={!isValid || isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Task...</> : "Create Task"}
            </Button>
          </form>
        </div>
      </main>
      <Toaster />
    </div>
  );
}