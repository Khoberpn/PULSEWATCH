"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/ui/modal";
import { Input } from "@/ui/input";
import { Select } from "@/ui/select";
import { Button } from "@/ui/button";
import { Monitor, MonitorCreatePayload } from "@/lib/types";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface MonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  monitor?: Monitor | null;
}

export const MonitorModal: React.FC<MonitorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  monitor,
}) => {
  const isEditing = Boolean(monitor);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [checkInterval, setCheckInterval] = useState(60);
  const [timeout, setTimeoutSec] = useState(10);
  const [expectedCodes, setExpectedCodes] = useState("200-399");
  const [degradedThreshold, setDegradedThreshold] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (monitor) {
      setName(monitor.name);
      setUrl(monitor.url);
      setMethod(monitor.method);
      setCheckInterval(monitor.check_interval);
      setTimeoutSec(monitor.timeout);
      setExpectedCodes(monitor.expected_status_codes);
      setDegradedThreshold(monitor.degraded_threshold_ms);
    } else {
      setName("");
      setUrl("https://");
      setMethod("GET");
      setCheckInterval(60);
      setTimeoutSec(10);
      setExpectedCodes("200-399");
      setDegradedThreshold(1000);
    }
    setErrorMessage(null);
  }, [monitor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage("Monitor name is required.");
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setErrorMessage("URL must begin with http:// or https://");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing && monitor) {
        await api.updateMonitor(monitor.id, {
          name: name.trim(),
          url: url.trim(),
          method,
          check_interval: Number(checkInterval),
          timeout: Number(timeout),
          expected_status_codes: expectedCodes.trim(),
          degraded_threshold_ms: Number(degradedThreshold),
        });
        toast({
          title: "Monitor Updated",
          description: `Configuration saved for "${name}".`,
          variant: "success",
        });
      } else {
        const payload: MonitorCreatePayload = {
          name: name.trim(),
          url: url.trim(),
          method,
          check_interval: Number(checkInterval),
          timeout: Number(timeout),
          expected_status_codes: expectedCodes.trim(),
          degraded_threshold_ms: Number(degradedThreshold),
          enabled: true,
        };
        await api.createMonitor(payload);
        toast({
          title: "Monitor Created",
          description: `Monitoring started for "${name}". First check is running.`,
          variant: "success",
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save monitor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Monitor Configuration" : "Create New Monitor"}
      description="Configure target endpoint, check frequency, and alert thresholds."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-md">
            {errorMessage}
          </div>
        )}

        <Input
          label="Monitor Name"
          placeholder="e.g. Production API Gateway"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <Input
              label="Target URL"
              placeholder="https://api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              helperText="Only HTTP/HTTPS endpoints. SSRF protection applies."
              required
            />
          </div>
          <div className="col-span-1">
            <Select
              label="Method"
              value={method}
              onChange={(e) => setMethod(e.target.value as "GET" | "HEAD")}
              options={[
                { label: "GET", value: "GET" },
                { label: "HEAD", value: "HEAD" },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Check Interval"
            value={checkInterval}
            onChange={(e) => setCheckInterval(Number(e.target.value))}
            options={[
              { label: "Every 15 seconds", value: 15 },
              { label: "Every 30 seconds", value: 30 },
              { label: "Every 60 seconds (1m)", value: 60 },
              { label: "Every 3 minutes", value: 180 },
              { label: "Every 5 minutes", value: 300 },
              { label: "Every 15 minutes", value: 900 },
            ]}
          />
          <Select
            label="Request Timeout"
            value={timeout}
            onChange={(e) => setTimeoutSec(Number(e.target.value))}
            options={[
              { label: "5 seconds", value: 5 },
              { label: "10 seconds (default)", value: 10 },
              { label: "15 seconds", value: 15 },
              { label: "30 seconds", value: 30 },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Expected Status Codes"
            placeholder="200-399"
            value={expectedCodes}
            onChange={(e) => setExpectedCodes(e.target.value)}
            helperText="e.g. 200-399 or 200,201,204"
            required
          />
          <Input
            label="Degraded Threshold (ms)"
            type="number"
            min={100}
            max={30000}
            value={degradedThreshold}
            onChange={(e) => setDegradedThreshold(Number(e.target.value))}
            helperText="Marks DEGRADED if response exceeds this"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? "Save Changes" : "Start Monitoring"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
