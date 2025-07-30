"use client";

import { useState, useEffect } from 'react';
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Plus, MapPin, Trash2, Building2, Navigation, Map } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Office {
    id: number;
    officeName: string;
    address: string;
    latitude: number;
    longitude: number;
    geofenceRadius: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export default function OfficeManagement() {
    const { toast } = useToast();
    
    // 🔥 FIXED: Use direct fetch instead of React Query
    const [offices, setOffices] = useState<Office[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Direct fetch function
    const fetchOffices = async () => {
        try {
            console.log('🚀 FETCHING OFFICES DIRECTLY...');
            const response = await fetch('/api/offices');
            const data = await response.json();
            console.log('📥 DIRECT FETCH RESPONSE:', data);
            console.log('📋 IS ARRAY:', Array.isArray(data));
            console.log('📋 LENGTH:', data?.length);
            
            if (Array.isArray(data)) {
                setOffices(data);
                console.log('✅ OFFICES SET:', data.length);
            } else {
                console.error('❌ API returned non-array:', data);
                setOffices([]);
            }
        } catch (error) {
            console.error('❌ FETCH ERROR:', error);
            setOffices([]);
        }
    };

    // Load offices on component mount
    useEffect(() => {
        fetchOffices();
    }, []);

    // Create office mutation
    const createOfficeMutation = useMutation({
        mutationFn: async (officeData: any) => {
            console.log('🚀 Sending office data:', officeData);
            const response = await fetch('/api/offices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(officeData)
            });
            return response.json();
        },
        onSuccess: (data) => {
            console.log('✅ Office created successfully:', data);
            fetchOffices(); // Refresh the list
            setShowAddForm(false);
            resetForm();
            toast({
                title: "✅ Office Created!",
                description: `${data.officeName} has been added successfully.`
            });
        },
        onError: (error: any) => {
            console.error('❌ Create office error:', error);
            toast({
                title: "❌ Error",
                description: "Failed to create office. Please try again.",
                variant: "destructive"
            });
        }
    });

    // Delete office mutation
    const deleteOfficeMutation = useMutation({
        mutationFn: async (officeId: number) => {
            console.log('🗑️ Deleting office ID:', officeId);
            const response = await fetch(`/api/offices/${officeId}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        onSuccess: () => {
            console.log('✅ Office deleted successfully');
            fetchOffices(); // Refresh the list
            toast({
                title: "✅ Office Deleted",
                description: "Office has been removed successfully."
            });
        },
        onError: (error: any) => {
            console.error('❌ Delete office error:', error);
            toast({
                title: "❌ Error",
                description: "Failed to delete office. Please try again.",
                variant: "destructive"
            });
        }
    });

    const [showAddForm, setShowAddForm] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [formData, setFormData] = useState({
        officeName: '',
        address: '',
        latitude: 0,
        longitude: 0,
        geofenceRadius: 500
    });

    const resetForm = () => {
        setFormData({
            officeName: '',
            address: '',
            latitude: 0,
            longitude: 0,
            geofenceRadius: 500
        });
    };

    // Get current location with reverse geocoding
    const getCurrentLocation = () => {
        setLocationLoading(true);

        if (!navigator.geolocation) {
            toast({
                title: "❌ Error",
                description: "Geolocation is not supported by this browser.",
                variant: "destructive"
            });
            setLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // Set coordinates first
                setFormData(prev => ({
                    ...prev,
                    latitude: parseFloat(latitude.toFixed(6)),
                    longitude: parseFloat(longitude.toFixed(6))
                }));

                // Get address using BigDataCloud (free, no API key needed)
                try {
                    console.log('🌍 Getting address for:', latitude, longitude);
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    const data = await response.json();
                    
                    if (data.locality && data.principalSubdivision) {
                        const address = `${data.locality}, ${data.principalSubdivision}, ${data.countryName}`;
                        setFormData(prev => ({
                            ...prev,
                            address: address
                        }));
                        
                        toast({
                            title: "📍 Location & Address Found!",
                            description: address
                        });
                    } else {
                        toast({
                            title: "📍 Location Found!",
                            description: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
                        });
                    }
                } catch (error) {
                    console.error('❌ Address lookup failed:', error);
                    toast({
                        title: "📍 Location Found!",
                        description: `Coordinates set, please enter address manually`
                    });
                }

                setLocationLoading(false);
            },
            (error) => {
                console.error('❌ Error getting location:', error);
                toast({
                    title: "❌ Location Error",
                    description: "Could not get your current location.",
                    variant: "destructive"
                });
                setLocationLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    };

    const handleAddOffice = () => {
        console.log('🚨 BUTTON CLICKED!');
        console.log('🏢 Form data before validation:', formData);

        if (!formData.officeName.trim()) {
            toast({
                title: "❌ Missing Office Name",
                description: "Please enter an office name.",
                variant: "destructive"
            });
            return;
        }

        if (!formData.address.trim()) {
            toast({
                title: "❌ Missing Address",
                description: "Please enter an address.",
                variant: "destructive"
            });
            return;
        }

        if (formData.latitude === 0 || formData.longitude === 0) {
            toast({
                title: "❌ Missing Location",
                description: "Please set the office location.",
                variant: "destructive"
            });
            return;
        }

        // Create office via API
        console.log('🚀 Creating office with data:', formData);
        createOfficeMutation.mutate(formData);
    };

    const handleDeleteOffice = (office: Office) => {
        if (window.confirm(`Are you sure you want to delete "${office.officeName}"?`)) {
            deleteOfficeMutation.mutate(office.id);
        }
    };

    const openInMaps = (lat: number, lng: number, name: string) => {
        const url = `https://www.google.com/maps?q=${lat},${lng}&z=15&t=m`;
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">🏢 Office Management</h1>
                    <p className="text-gray-600">Manage office locations and geofencing settings</p>
                </div>
                <div className="flex space-x-2">
                    <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Office
                    </Button>
                    <Button onClick={fetchOffices} variant="outline">
                        🔄 Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center">
                            <Building2 className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Offices</p>
                                <p className="text-2xl font-bold text-gray-900">{offices.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center">
                            <MapPin className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Active Locations</p>
                                <p className="text-2xl font-bold text-gray-900">{offices.filter((o: Office) => o.isActive).length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center">
                            <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                                <span className="text-orange-600 font-bold">📍</span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Avg Geofence</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {offices.length > 0 ? Math.round(offices.reduce((sum: number, o: Office) => sum + o.geofenceRadius, 0) / offices.length) : 0}m
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Add Office Form */}
            {showAddForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>🏢 Add New Office</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="officeName">Office Name *</Label>
                                    <Input
                                        id="officeName"
                                        value={formData.officeName}
                                        onChange={(e) => setFormData({ ...formData, officeName: e.target.value })}
                                        placeholder="e.g., Head Office"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="address">Address *</Label>
                                    <Input
                                        id="address"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Full office address"
                                    />
                                </div>
                            </div>

                            {/* Location Section */}
                            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-blue-900">📍 Set Location</h3>
                                    <Button 
                                        onClick={getCurrentLocation}
                                        disabled={locationLoading}
                                        className="bg-green-600 hover:bg-green-700"
                                        size="sm"
                                    >
                                        <Navigation className="w-4 h-4 mr-2" />
                                        {locationLoading ? "Getting..." : "Use My Location"}
                                    </Button>
                                </div>

                                {formData.latitude !== 0 && formData.longitude !== 0 ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <div className="flex items-center space-x-2">
                                            <MapPin className="w-5 h-5 text-green-600" />
                                            <div>
                                                <p className="font-medium text-green-800">✅ Location Set!</p>
                                                <p className="text-sm text-green-600">
                                                    📍 {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600">Click "Use My Location" to set office coordinates</p>
                                    </div>
                                )}

                                {/* Manual Entry */}
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Label htmlFor="latitude" className="text-sm">Latitude</Label>
                                        <Input
                                            id="latitude"
                                            type="number"
                                            step="0.000001"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                                            placeholder="24.8607"
                                            className="text-sm"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="longitude" className="text-sm">Longitude</Label>
                                        <Input
                                            id="longitude"
                                            type="number"
                                            step="0.000001"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                                            placeholder="67.0011"
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Geofence Radius */}
                            <div>
                                <Label>🔄 Geofence Radius: {formData.geofenceRadius}m</Label>
                                <Slider
                                    value={[formData.geofenceRadius]}
                                    onValueChange={(value) => setFormData({ ...formData, geofenceRadius: value[0] })}
                                    max={5000}
                                    min={100}
                                    step={50}
                                    className="mt-2"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>100m</span>
                                    <span>5000m</span>
                                </div>
                            </div>

                            <div className="flex space-x-2 pt-4">
                                <Button 
                                    onClick={handleAddOffice} 
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={createOfficeMutation.isPending}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {createOfficeMutation.isPending ? "Adding..." : "Add Office"}
                                </Button>
                                <Button variant="outline" onClick={() => {
                                    setShowAddForm(false);
                                    resetForm();
                                }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Offices List */}
            <Card>
                <CardHeader>
                    <CardTitle>🏢 Office Locations ({offices.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {offices.length === 0 ? (
                        <div className="text-center py-12">
                            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Offices Yet</h3>
                            <p className="text-gray-500 mb-4">Add your first office location to get started</p>
                            <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Office
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {offices.map((office: Office) => (
                                <div key={office.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                <Building2 className="w-5 h-5 text-blue-600" />
                                                <h3 className="font-semibold text-lg">{office.officeName}</h3>
                                                <span className={`px-2 py-1 text-xs rounded-full ${office.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {office.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <p className="text-gray-600 mt-1">{office.address}</p>
                                            <div className="flex space-x-4 mt-2 text-sm text-gray-500">
                                                <span>📍 {office.latitude}, {office.longitude}</span>
                                                <span>🔄 {office.geofenceRadius}m radius</span>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openInMaps(office.latitude, office.longitude, office.officeName)}
                                                title="View in Maps"
                                            >
                                                <Map className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleDeleteOffice(office)}
                                                disabled={deleteOfficeMutation.isPending}
                                                title="Delete Office"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}