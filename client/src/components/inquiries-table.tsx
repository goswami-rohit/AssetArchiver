import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Search, Download } from "lucide-react";
import { useState } from "react";

interface InquiriesTableProps {
  limit?: number;
  showHeader?: boolean;
  title?: string;
}

export default function InquiriesTable({ limit, showHeader = false, title = "All Inquiries" }: InquiriesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  
  const { data: inquiries, isLoading } = useQuery({
    queryKey: ["/api/admin/inquiries", { limit }],
  });

  const filteredInquiries = inquiries?.filter((inquiry: any) => {
    const matchesSearch = inquiry.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inquiry.material.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !cityFilter || inquiry.city === cityFilter;
    return matchesSearch && matchesCity;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "responded":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMaterialColor = (material: string) => {
    return material.toLowerCase() === "cement" 
      ? "bg-gray-100 text-gray-800"
      : "bg-blue-100 text-blue-800";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className={showHeader ? "border-b border-slate-200" : "pb-2"}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
          {!showHeader && (
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search inquiries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Cities</SelectItem>
                  <SelectItem value="Guwahati">Guwahati</SelectItem>
                  <SelectItem value="Mumbai">Mumbai</SelectItem>
                  <SelectItem value="Delhi">Delhi</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}
          {showHeader && (
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              View All
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vendors</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <Search className="w-12 h-12 text-slate-300" />
                      <p className="text-slate-500">No inquiries found</p>
                      <p className="text-sm text-slate-400">Try adjusting your search criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inquiry: any) => (
                  <tr key={inquiry.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-900">{inquiry.userName}</div>
                          {inquiry.userPhone && (
                            <div className="text-xs text-slate-500">{inquiry.userPhone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getMaterialColor(inquiry.material)}>
                        {inquiry.material}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {inquiry.city}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {inquiry.vendorsContacted?.length || 0} contacted
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusColor(inquiry.status)}>
                        {inquiry.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(inquiry.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!showHeader && filteredInquiries.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing {filteredInquiries.length} of {inquiries?.length || 0} inquiries
              </p>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm" className="bg-primary text-white">1</Button>
                <Button variant="outline" size="sm">2</Button>
                <Button variant="outline" size="sm">3</Button>
                <Button variant="outline" size="sm">Next</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
