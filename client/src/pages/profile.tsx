import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import BottomNavigation from "@/components/bottom-navigation";
import { VITE_API_BASE_URL } from "@/lib/config";

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Fetch customer data from database
  const { data: customerData, isLoading } = useQuery({
    queryKey: ['/api/customer/profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      const response = await fetch(`${VITE_API_BASE_URL}/api/customer/profile?customerId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch customer data');
      const result = await response.json();
      return result.customer;
    },
    enabled: !!user?.id,
  });

  const [isEditing, setIsEditing] = useState(false);
  
  // Use customer data if available, fallback to user data
  const displayName = customerData?.name || `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim();
  const firstName = customerData?.name?.split(' ')[0] || user?.firstName || 'User';
  const lastName = customerData?.name?.split(' ').slice(1).join(' ') || user?.lastName || '';
  const email = customerData?.email || user?.email || '';
  const phone = customerData?.phone || '';
  const isVerified = customerData?.is_verified || user?.isPhoneVerified || false;

  const [editData, setEditData] = useState({
    firstName: firstName,
    lastName: lastName,
    email: email,
  });

  // Update editData when customer data loads
  useEffect(() => {
    if (customerData) {
      const nameParts = customerData.name?.split(' ') || [];
      setEditData({
        firstName: nameParts[0] || 'User',
        lastName: nameParts.slice(1).join(' ') || '',
        email: customerData.email || '',
      });
    }
  }, [customerData]);

  const [preferences, setPreferences] = useState({
    notifications: true,
    emailUpdates: false,
    doorOpening: false,
    quietRides: false,
  });

  const [deleteAccountState, setDeleteAccountState] = useState({
    showForm: false,
    isSubmitting: false,
    isCompleted: false,
  });

  const { theme, toggleTheme, isAutoMode, setAutoMode } = useTheme();

  const handleSaveProfile = () => {
    // In a real app, this would update the user profile in the database
    toast({
      title: "Profile Updated",
      description: "Your profile has been updated successfully",
    });
    setIsEditing(false);
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real app, this would call the delete account API
      setDeleteAccountState(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        isCompleted: true 
      }));
      
      toast({
        title: "Account Deletion Requested",
        description: "Your account deletion request has been submitted.",
      });
    } catch (error) {
      setDeleteAccountState(prev => ({ ...prev, isSubmitting: false }));
      toast({
        title: "Error",
        description: "Failed to submit account deletion request. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show loading state while fetching customer data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-muted animate-pulse rounded-full"></div>
            <div>
              <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-20 bg-muted animate-pulse rounded mt-2"></div>
            </div>
          </div>
        </header>
        <main className="p-4">
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="driver-card">
                <div className="p-6 space-y-4">
                  <div className="h-6 w-40 bg-muted animate-pulse rounded"></div>
                  <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </main>
        <BottomNavigation currentPage="profile" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-12 h-12 border-2 border-primary/20">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
              {firstName?.[0]}{lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-primary">{displayName}</h1>
            <p className="text-xs text-muted-foreground flex items-center">
              <i className="fas fa-user text-primary mr-1"></i>
              Customer
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Profile Information */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center text-primary">
              <i className="fas fa-user text-accent mr-2"></i>
              Profile Information
            </h2>
            <Button
              size="sm"
              variant={isEditing ? "default" : "outline"}
              onClick={isEditing ? handleSaveProfile : () => setIsEditing(true)}
              className={isEditing ? "bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}
              data-testid={isEditing ? "button-saveProfile" : "button-editProfile"}
            >
              <i className={`fas ${isEditing ? 'fa-save' : 'fa-edit'} mr-1`}></i>
              {isEditing ? 'Save' : 'Edit'}
            </Button>
          </div>

          <div className="driver-card">
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    data-testid="input-firstName"
                    value={editData.firstName}
                    onChange={(e) => setEditData(prev => ({ ...prev, firstName: e.target.value }))}
                    disabled={!isEditing}
                    className="bg-background border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    data-testid="input-lastName"
                    value={editData.lastName}
                    onChange={(e) => setEditData(prev => ({ ...prev, lastName: e.target.value }))}
                    disabled={!isEditing}
                    className="bg-background border-border focus:border-primary"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  value={editData.email}
                  onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!isEditing}
                  className="bg-background border-border focus:border-primary"
                />
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <i className={`fas fa-phone ${isVerified ? 'text-accent' : 'text-muted-foreground'}`}></i>
                    <span className={isVerified ? 'text-accent' : 'text-muted-foreground'}>
                      {isVerified ? 'Email Verified' : 'Email Not Verified'}
                    </span>
                  </div>
                  {phone && phone !== '0000000000' && (
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-mobile-alt text-primary"></i>
                      <span className="text-primary">{phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-shield-alt text-primary"></i>
                    <span className="text-primary">Secure Account</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ride Preferences */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center text-primary">
            <i className="fas fa-sliders-h text-accent mr-2"></i>
            Ride Preferences
          </h2>

          <div className="driver-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">Door Opening Service</p>
                  <p className="text-sm text-muted-foreground">Request drivers to open doors</p>
                </div>
                <div className="yah-switch-container">
                  <Switch
                    checked={preferences.doorOpening}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, doorOpening: checked }))}
                    data-testid="switch-doorOpening"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">Quiet Rides Default</p>
                  <p className="text-sm text-muted-foreground">Prefer quiet ride types</p>
                </div>
                <div className="yah-switch-container">
                  <Switch
                    checked={preferences.quietRides}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, quietRides: checked }))}
                    data-testid="switch-quietRides"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notification Settings */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center text-primary">
            <i className="fas fa-bell text-accent mr-2"></i>
            Notifications
          </h2>

          <div className="driver-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Ride updates and alerts</p>
                </div>
                <div className="yah-switch-container">
                  <Switch
                    checked={preferences.notifications}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, notifications: checked }))}
                    data-testid="switch-notifications"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">Email Updates</p>
                  <p className="text-sm text-muted-foreground">Promotional and feature updates</p>
                </div>
                <div className="yah-switch-container">
                  <Switch
                    checked={preferences.emailUpdates}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, emailUpdates: checked }))}
                    data-testid="switch-emailUpdates"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Support & Safety */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center text-primary">
            <i className="fas fa-shield-alt text-accent mr-2"></i>
            Support & Safety
          </h2>

          <div className="space-y-3">
            <div className="driver-card cursor-pointer hover:border-primary/30 transition-colors">
              <div className="p-4 flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <i className="fas fa-headset text-primary"></i>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary">Yah™Chat Support</p>
                  <p className="text-sm text-muted-foreground">Get help from our AI assistant</p>
                </div>
                <i className="fas fa-chevron-right text-muted-foreground"></i>
              </div>
            </div>

            <div className="driver-card cursor-pointer hover:border-primary/30 transition-colors">
              <div className="p-4 flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                  <i className="fas fa-exclamation-triangle text-accent"></i>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary">Report an Issue</p>
                  <p className="text-sm text-muted-foreground">Report driver or safety concerns</p>
                </div>
                <i className="fas fa-chevron-right text-muted-foreground"></i>
              </div>
            </div>

            <div className="driver-card cursor-pointer hover:border-primary/30 transition-colors">
              <div className="p-4 flex items-center space-x-3">
                <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                  <i className="fas fa-file-alt text-primary"></i>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary">Privacy & Terms</p>
                  <p className="text-sm text-muted-foreground">Review our policies</p>
                </div>
                <i className="fas fa-chevron-right text-muted-foreground"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Theme Settings */}
        <section>
          <div className="driver-card">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center mb-6">
                <i className="fas fa-sun text-yellow-500 mr-3 text-xl"></i>
                <h2 className="text-xl font-semibold text-primary">Day/Night Mode Settings</h2>
              </div>

              {/* Theme Mode Selector */}
              <div className="mb-6">
                <h3 className="text-base font-medium text-primary mb-3">Theme Mode</h3>
                <div className="relative">
                  <select
                    value={isAutoMode ? 'auto' : theme}
                    onChange={(e) => {
                      if (e.target.value === 'auto') {
                        setAutoMode(true);
                      } else {
                        setAutoMode(false);
                        if (e.target.value !== theme) {
                          toggleTheme();
                        }
                      }
                    }}
                    className="w-full p-2 border-2 border-primary rounded-lg bg-background text-primary font-medium focus:outline-none focus:border-accent appearance-none cursor-pointer h-10"
                    data-testid="select-themeMode"
                  >
                    <option value="auto">🔄 Auto (Day/Night)</option>
                    <option value="light">☀️ Light Mode</option>
                    <option value="dark">🌙 Dark Mode</option>
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-primary pointer-events-none"></i>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-accent/10 rounded-lg p-4 border border-accent/20">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-accent rounded-full mr-2"></div>
                  <span className="font-medium text-primary">
                    Currently: {theme === 'light' ? 'Day Mode' : 'Night Mode'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isAutoMode 
                    ? 'Automatically switches based on time of day'
                    : `Always use ${theme} theme regardless of time`}
                </p>
                {isAutoMode && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>• Automatically switches based on time of day</p>
                    <p>• Considers seasonal changes (winter = earlier night mode)</p>
                    <p>• Updates every minute when active</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Yah™ Delete Account */}
        <section>
          <div className="text-center mb-4">
            <div className="w-full h-px bg-border mb-6"></div>
          </div>
          
          <h2 className="text-xl font-semibold mb-6 text-center text-primary">Yah™ Delete Account</h2>

          {!deleteAccountState.showForm && !deleteAccountState.isCompleted && (
            <div className="driver-card">
              <div className="p-6 text-center space-y-4">
                <Button
                  variant="destructive"
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => setDeleteAccountState(prev => ({ ...prev, showForm: true }))}
                  data-testid="button-requestDeletion"
                >
                  🗑️ Request Account Deletion
                </Button>
                <p className="text-sm text-muted-foreground">We're sorry to see you go.</p>
              </div>
            </div>
          )}

          {deleteAccountState.showForm && !deleteAccountState.isCompleted && (
            <div className="driver-card">
              <div className="p-6 space-y-4">
                <p className="text-center text-muted-foreground">
                  If you wish to permanently delete your Yah™ account, please fill out the form below and submit.
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-600">⚠️</span>
                    <p className="text-sm text-yellow-800 font-medium">
                      This action is irreversible. All personal data will be permanently removed.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deleteReason">Reason for deletion (optional)</Label>
                    <select 
                      id="deleteReason"
                      className="w-full p-2 border border-border rounded-lg bg-background text-primary"
                      data-testid="select-deleteReason"
                    >
                      <option value="">Select a reason...</option>
                      <option value="no-longer-needed">No longer needed</option>
                      <option value="privacy-concerns">Privacy concerns</option>
                      <option value="poor-service">Poor service experience</option>
                      <option value="switching-service">Switching to another service</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      variant="destructive"
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={handleDeleteAccount}
                      disabled={deleteAccountState.isSubmitting}
                      data-testid="button-confirmDeletion"
                    >
                      {deleteAccountState.isSubmitting ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-trash mr-2"></i>
                          Confirm Deletion
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-border"
                      onClick={() => setDeleteAccountState(prev => ({ ...prev, showForm: false }))}
                      disabled={deleteAccountState.isSubmitting}
                      data-testid="button-cancelDeletion"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteAccountState.isCompleted && (
            <div className="driver-card">
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <i className="fas fa-check text-2xl text-green-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-primary">Thank you for being with us!</h3>
                <p className="text-muted-foreground">
                  We wish you the very best in your future life, and thank you for being part of Yah™ Global.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Account Actions */}
        <section>
          <div className="space-y-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                  data-testid="button-logout"
                >
                  <i className="fas fa-sign-out-alt mr-3"></i>
                  Sign Out
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-border">
                <DialogHeader>
                  <DialogTitle className="text-primary">Confirm Sign Out</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-muted-foreground">Are you sure you want to sign out of your account?</p>
                  <div className="flex space-x-3">
                    <Button
                      variant="destructive"
                      onClick={handleLogout}
                      className="flex-1"
                      data-testid="button-confirmLogout"
                    >
                      Sign Out
                    </Button>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 border-border">
                        Cancel
                      </Button>
                    </DialogTrigger>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      </main>

      <BottomNavigation currentPage="profile" />
    </div>
  );
}
