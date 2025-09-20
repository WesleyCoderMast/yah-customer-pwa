import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ViolationType {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  action: string;
  severity: string;
  requires_immediate_action: boolean;
}

interface ReportDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  rideId: string;
  customerId: string;
}

export default function ReportDriverModal({
  isOpen,
  onClose,
  driverId,
  driverName,
  rideId,
  customerId,
}: ReportDriverModalProps) {
  const { toast } = useToast();
  const [selectedViolation, setSelectedViolation] = useState<number | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  // Fetch violation types
  const { data: violationTypesData, isLoading: isLoadingViolations } = useQuery({
    queryKey: ["/api/violation-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/violation-types");
      return response.json();
    },
    enabled: isOpen,
  });

  const violationTypes: ViolationType[] = violationTypesData?.violationTypes || [];

  // Create report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const response = await apiRequest("POST", "/api/reports", reportData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Your report has been submitted successfully. We'll review it shortly.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Submit Report",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleViolationSelect = (violationId: number) => {
    setSelectedViolation(violationId === selectedViolation ? null : violationId);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedViolation && !customReason.trim()) {
      toast({
        title: "Select Violation Type",
        description: "Please select a violation type or provide a custom reason.",
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      driverId,
      rideId,
      customerId,
      reportedBy: "customer",
      violationTypeId: selectedViolation || null,
      customReason: customReason.trim() || null,
      description: description.trim() || null,
      mediaFiles: mediaFiles.length > 0 ? mediaFiles.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        // In a real app, you'd upload to a storage service and get URLs
        url: URL.createObjectURL(file),
      })) : null,
      hasMedia: mediaFiles.length > 0,
      status: "pending",
    };

    createReportMutation.mutate(reportData);
  };

  const handleClose = () => {
    setSelectedViolation(null);
    setCustomReason("");
    setDescription("");
    setMediaFiles([]);
    onClose();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("BAN")) {
      return "bg-red-600/20 text-red-400 border-red-600/30";
    } else if (action.includes("Review")) {
      return "bg-orange-600/20 text-orange-400 border-orange-600/30";
    } else {
      return "bg-blue-600/20 text-blue-400 border-blue-600/30";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-yah-gold/20 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-yah-gold text-center text-xl">
            Report Driver: {driverName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-4">
          {/* Violation Types */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Select Violation Type</h3>
            {isLoadingViolations ? (
              <div className="text-center py-4">
                <i className="fas fa-spinner fa-spin text-yah-gold text-xl"></i>
                <p className="text-gray-400 mt-2">Loading violation types...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {violationTypes.map((violation) => (
                  <Card
                    key={violation.id}
                    className={`p-4 cursor-pointer transition-all duration-200 border-2 ${
                      selectedViolation === violation.id
                        ? "border-yah-gold bg-yah-gold/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                    onClick={() => handleViolationSelect(violation.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <span className="text-2xl">{violation.icon}</span>
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{violation.name}</h4>
                          <p className="text-gray-400 text-sm mt-1">{violation.description}</p>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            selectedViolation === violation.id
                              ? "border-yah-gold bg-yah-gold"
                              : "border-gray-500"
                          }`}
                        >
                          {selectedViolation === violation.id && (
                            <i className="fas fa-check text-yah-darker text-xs"></i>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Custom Reason */}
          <div className="space-y-2">
            <label className="text-white font-medium">Custom Reason (if "Other" selected)</label>
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Please describe the violation..."
              className="bg-yah-muted border-yah-gold/30 text-white placeholder:text-gray-400"
              rows={3}
            />
          </div>

          {/* Additional Description */}
          <div className="space-y-2">
            <label className="text-white font-medium">Additional Details</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional details about the incident..."
              className="bg-yah-muted border-yah-gold/30 text-white placeholder:text-gray-400"
              rows={4}
            />
          </div>

          {/* Media Upload */}
          <div className="space-y-3">
            <label className="text-white font-medium">Evidence (Photos/Videos)</label>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <i className="fas fa-camera text-yah-gold text-2xl"></i>
                <span className="text-gray-400">Click to upload photos or videos</span>
                <span className="text-gray-500 text-sm">Optional evidence</span>
              </label>
            </div>
            
            {mediaFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Uploaded files:</p>
                <div className="space-y-1">
                  {mediaFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                      <span className="text-white text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <i className="fas fa-exclamation-triangle text-red-400 mt-1"></i>
              <div>
                <h4 className="text-red-400 font-medium">Important Notice</h4>
                <p className="text-gray-300 text-sm mt-1">
                  False reports may result in account suspension. Only report genuine violations.
                  Repeated violations may result in permanent blocking.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={createReportMutation.isPending || !selectedViolation}
              className="flex-1 bg-gradient-gold text-yah-darker font-semibold"
            >
              {createReportMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Submitting Report...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2"></i>
                  Submit Report
                </>
              )}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-yah-gold/30 text-yah-gold hover:bg-yah-gold/10"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
