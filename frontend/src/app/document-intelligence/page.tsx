"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from 'react';
import Link from "next/link";
import { ArrowLeft, Upload, FileText, Database, Settings, AlertCircle, Download, File, Eye, Play, Loader2, Lightbulb, Save, ChevronDown, ChevronRight } from "lucide-react";
import { apiCall } from "@/lib/api-config";

interface SelectedFile {
    file: File;
    name: string;
    size: number;
    type: string;
    preview?: string;
    previewUrl?: string;
    isUploaded: boolean;
    ucPath?: string;
    isProcessing: boolean;
    processError?: string;
}

interface WarehouseConfig {
    warehouse_id: string;
    default_warehouse_id: string;
}

interface VolumePathConfig {
    volume_path: string;
    default_volume_path: string;
}

interface DeltaTablePathConfig {
    delta_table_path: string;
    default_delta_table_path: string;
}

export default function DocumentIntelligencePage() {
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Demo Value and Settings state
    const [showValueModal, setShowValueModal] = useState(false);
    const [showWarehouseConfig, setShowWarehouseConfig] = useState(false);
    const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfig>({ warehouse_id: '', default_warehouse_id: '' });
    const [newWarehouseId, setNewWarehouseId] = useState('');
    const [warehouseLoading, setWarehouseLoading] = useState(false);
    const [warehouseSuccess, setWarehouseSuccess] = useState(false);

    // Volume path configuration state
    const [volumePathConfig, setVolumePathConfig] = useState<VolumePathConfig>({ volume_path: '', default_volume_path: '' });
    const [newVolumePath, setNewVolumePath] = useState('');
    const [volumePathLoading, setVolumePathLoading] = useState(false);
    const [volumePathSuccess, setVolumePathSuccess] = useState(false);

    // Delta table path configuration state
    const [deltaTablePathConfig, setDeltaTablePathConfig] = useState<DeltaTablePathConfig>({ delta_table_path: '', default_delta_table_path: '' });
    const [newDeltaTablePath, setNewDeltaTablePath] = useState('');
    const [deltaTablePathLoading, setDeltaTablePathLoading] = useState(false);
    const [deltaTablePathSuccess, setDeltaTablePathSuccess] = useState(false);

    // Collapse state for panels
    const [isDocumentPreviewCollapsed, setIsDocumentPreviewCollapsed] = useState(false);
    const [isFileUploadCollapsed, setIsFileUploadCollapsed] = useState(false);
    const [isSelectedFilesCollapsed, setIsSelectedFilesCollapsed] = useState(false);
    const [isDeltaTableResultsCollapsed, setIsDeltaTableResultsCollapsed] = useState(false);

    // Delta table state
    const [deltaTableResults, setDeltaTableResults] = useState<any[]>([]);
    const [deltaTableLoading, setDeltaTableLoading] = useState(false);
    const [deltaTableError, setDeltaTableError] = useState<string | null>(null);
    const [processedSessionFiles, setProcessedSessionFiles] = useState<string[]>([]);
    const [showDeltaTableResults, setShowDeltaTableResults] = useState(false);

    // AI Functions test state
    const [aiTestLoading, setAiTestLoading] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{success: boolean, message: string} | null>(null);
    
    // Excel generation state
    const [excelGenerationLoading, setExcelGenerationLoading] = useState(false);
    const [excelGenerationError, setExcelGenerationError] = useState<string | null>(null);
    const [excelGenerationSuccess, setExcelGenerationSuccess] = useState(false);
    const [generatedExcelFiles, setGeneratedExcelFiles] = useState<any[]>([]);

    // Utility function to extract error message from various error types
    const getErrorMessage = (err: unknown): string => {
        // Debug logging to understand what we're receiving
        console.log('getErrorMessage received:', err, 'type:', typeof err);
        
        if (err instanceof Error) {
            return err.message;
        } else if (typeof err === 'string') {
            return err;
        } else if (err && typeof err === 'object') {
            const errObj = err as any;
            // Try multiple properties that might contain the error message
            const message = errObj.detail || errObj.message || errObj.error || errObj.statusText;
            if (message && typeof message === 'string') {
                return message;
            }
            // If no string message found, stringify the object but make it readable
            try {
                return JSON.stringify(err, null, 2);
            } catch {
                return 'Error object could not be serialized';
            }
        }
        return 'An unknown error occurred';
    };

    // Test AI Functions availability
    const testAiFunctions = async () => {
        setAiTestLoading(true);
        setAiTestResult(null);
        
        try {
            const response = await apiCall("/api/test-ai-functions", {
                method: "POST"
            });
            
            setAiTestResult({
                success: response.success,
                message: response.message
            });
        } catch (err) {
            setAiTestResult({
                success: false,
                message: getErrorMessage(err)
            });
        } finally {
            setAiTestLoading(false);
        }
    };

    // Load configuration on component mount
    useEffect(() => {
        const loadConfigurations = async () => {
            try {
                // Load warehouse config
                const warehouseConfig = await apiCall("/api/warehouse-config");
                setWarehouseConfig(warehouseConfig);
                setNewWarehouseId(warehouseConfig.warehouse_id || '');

                // Load volume path config
                const volumePathConfig = await apiCall("/api/volume-path-config");
                setVolumePathConfig(volumePathConfig);
                setNewVolumePath(volumePathConfig.volume_path || '');

                // Load delta table path config
                const deltaTablePathConfig = await apiCall("/api/delta-table-path-config");
                setDeltaTablePathConfig(deltaTablePathConfig);
                setNewDeltaTablePath(deltaTablePathConfig.delta_table_path || '');
            } catch (err) {
                console.warn('Failed to load configurations:', err);
            }
        };

        loadConfigurations();
    }, []);

    // Update warehouse configuration
    const updateWarehouseConfig = async () => {
        if (!newWarehouseId.trim()) return;
        
        setWarehouseLoading(true);
        setWarehouseSuccess(false);
        
        try {
            const result = await apiCall("/api/warehouse-config", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ warehouse_id: newWarehouseId.trim() }),
            });
            
            if (result.success) {
                setWarehouseConfig(prev => ({ ...prev, warehouse_id: result.warehouse_id }));
                setWarehouseSuccess(true);
                setTimeout(() => setWarehouseSuccess(false), 3000);
            } else {
                throw new Error(result.message || 'Failed to update warehouse ID');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update warehouse configuration');
        } finally {
            setWarehouseLoading(false);
        }
    };

    // Update volume path configuration
    const updateVolumePathConfig = async () => {
        if (!newVolumePath.trim()) return;
        
        setVolumePathLoading(true);
        setVolumePathSuccess(false);
        
        try {
            const result = await apiCall("/api/volume-path-config", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ volume_path: newVolumePath.trim() }),
            });
            
            if (result.success) {
                setVolumePathConfig(prev => ({ ...prev, volume_path: result.volume_path }));
                setVolumePathSuccess(true);
                setTimeout(() => setVolumePathSuccess(false), 3000);
            } else {
                throw new Error(result.message || 'Failed to update volume path');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update volume path configuration');
        } finally {
            setVolumePathLoading(false);
        }
    };

    // Update delta table path configuration
    const updateDeltaTablePathConfig = async () => {
        if (!newDeltaTablePath.trim()) return;
        
        setDeltaTablePathLoading(true);
        setDeltaTablePathSuccess(false);
        
        try {
            const result = await apiCall("/api/delta-table-path-config", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delta_table_path: newDeltaTablePath.trim() }),
            });
            
            if (result.success) {
                setDeltaTablePathConfig(prev => ({ ...prev, delta_table_path: result.delta_table_path }));
                setDeltaTablePathSuccess(true);
                setTimeout(() => setDeltaTablePathSuccess(false), 3000);
            } else {
                throw new Error(result.message || 'Failed to update delta table path');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update delta table path configuration');
        } finally {
            setDeltaTablePathLoading(false);
        }
    };

    // Cleanup blob URLs when component unmounts or files change
    useEffect(() => {
        return () => {
            selectedFiles.forEach(file => {
                if (file.previewUrl) {
                    URL.revokeObjectURL(file.previewUrl);
                }
            });
        };
    }, [selectedFiles]);

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            // Clean up old blob URLs
            selectedFiles.forEach(file => {
                if (file.previewUrl) {
                    URL.revokeObjectURL(file.previewUrl);
                }
            });

            const fileArray = Array.from(files).map(file => ({
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                isUploaded: false,
                isProcessing: false
            }));
            setSelectedFiles(fileArray);
            setActiveFileIndex(null);
            setError(null);
        }
    };

    const handleFilePreview = async (fileIndex: number) => {
        const file = selectedFiles[fileIndex];
        if (!file) return;

        setActiveFileIndex(fileIndex);

        // If preview already exists, no need to regenerate
        if (file.preview) return;

        // Generate preview for the file
        try {
            let preview = "";
            let previewUrl = "";
            
            if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
                // Text file - read content
                const text = await file.file.text();
                preview = text;
            } else if (file.type === 'application/pdf') {
                // PDF file - create blob URL for iframe preview
                const blob = new Blob([file.file], { type: 'application/pdf' });
                previewUrl = URL.createObjectURL(blob);
                preview = "PDF_PREVIEW"; // Special marker for PDF preview
            } else if (file.type.startsWith('image/')) {
                // Image file - create blob URL for image preview
                const blob = new Blob([file.file], { type: file.type });
                previewUrl = URL.createObjectURL(blob);
                preview = "IMAGE_PREVIEW"; // Special marker for image preview
            } else {
                // Other file types
                preview = `[Document - ${formatFileSize(file.size)}]

File: ${file.name}
Size: ${formatFileSize(file.size)}
Type: ${file.type}

Click the "Process" button to upload this file to UC Volume and extract its content using AI document parsing.`;
            }

            // Update the file with preview
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { ...f, preview, previewUrl } : f
            ));

        } catch (err) {
            setError(`Failed to preview file: ${err}`);
        }
    };

    // Function to collapse previous panels when an action is triggered
    const collapseAllPanels = () => {
        setIsFileUploadCollapsed(true);
        setIsSelectedFilesCollapsed(true);
        setIsSummarizeCollapsed(true);
        setIsLabelsCollapsed(true);
        setIsDocumentPreviewCollapsed(true);
        setIsAiResultsCollapsed(true);
        setIsDeltaTableResultsCollapsed(true);
        setIsExtractResultsCollapsed(true);
        setIsMaskResultsCollapsed(true);
    };

    const handleProcessFile = async (fileIndex: number) => {
        const file = selectedFiles[fileIndex];
        if (!file) return;

        // Processing starts without collapsing panels

        // Mark as processing
        setSelectedFiles(prev => prev.map((f, i) => 
            i === fileIndex ? { ...f, isProcessing: true, processError: undefined } : f
        ));

        try {
            // Step 1: Upload to UC Volume
            const formData = new FormData();
            formData.append('files', file.file);

            const uploadResult = await apiCall("/api/upload-to-uc", {
                method: "POST",
                body: formData
            });
            const ucPath = uploadResult.uploaded_files[0]?.path;

            if (!ucPath) {
                throw new Error("Failed to get UC path from upload response");
            }

            // Update file with UC path
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { ...f, isUploaded: true, ucPath } : f
            ));

            // Upload complete - mark file as uploaded and not processing
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { 
                    ...f, 
                    isProcessing: false
                } : f
            ));

        } catch (err) {
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { 
                    ...f, 
                    isProcessing: false, 
                    processError: getErrorMessage(err)
                } : f
            ));
        }
    };

    const writeToDeltaTable = async (filePaths: string[]) => {
        try {
            setDeltaTableError(null); // Clear previous errors
            setDeltaTableLoading(true); // Show loading state
            console.log("Starting write operation for:", filePaths);
            
            // FIRE AND FORGET: Start the write operation but don't wait for it
            // The backend will complete in 60+ seconds, but we'll poll for results
            apiCall("/api/write-to-delta-table", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: filePaths,
                    limit: 10
                })
            }).then(() => {
                console.log("Write operation completed in background");
            }).catch(error => {
                console.log("Write operation timeout (expected):", error.message);
            });
            
            // IMMEDIATELY show UI sections and start polling for results
            setProcessedSessionFiles(filePaths);
            setShowDeltaTableResults(true);
            setDeltaTableResults([]);
            setDeltaTableError("Processing document... This may take 1-2 minutes for large files.");
            
            console.log("Starting polling for results...");
            
            // POLL for results every 10 seconds
            const pollForResults = async (attemptCount = 0) => {
                const maxAttempts = 30; // 5 minutes of polling (30 * 10 seconds)
                
                if (attemptCount >= maxAttempts) {
                    setDeltaTableError("Processing is taking longer than expected. The operation may still be running in the background. Try refreshing in a few minutes.");
                    setDeltaTableLoading(false);
                    return;
                }
                
                try {
                    console.log(`Polling attempt ${attemptCount + 1}/${maxAttempts}`);
                    const queryResult = await apiCall("/api/query-delta-table", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            file_paths: filePaths,
                            limit: 10
                        })
                    });
                    
                    if (queryResult.success && queryResult.data && queryResult.data.length > 0) {
                        // SUCCESS: Found results!
                        setDeltaTableResults(queryResult.data);
                        setDeltaTableError(null);
                        setDeltaTableLoading(false);
                        console.log(`SUCCESS: Retrieved ${queryResult.data.length} results after ${attemptCount + 1} attempts`);
                        return;
                    } else {
                        // No results yet, continue polling
                        console.log(`No results yet, will retry in 10 seconds...`);
                        setTimeout(() => pollForResults(attemptCount + 1), 10000);
                    }
                    
                } catch (error) {
                    console.error(`Polling attempt ${attemptCount + 1} failed:`, error);
                    // Continue polling even if individual queries fail
                    setTimeout(() => pollForResults(attemptCount + 1), 10000);
                }
            };
            
            // Start polling immediately
            setTimeout(() => pollForResults(), 1000); // Start polling after 1 second
            
        } catch (error) {
            console.error("Error starting write operation:", error);
            setDeltaTableError("Failed to start processing operation");
            setDeltaTableLoading(false);
            setShowDeltaTableResults(false);
        } finally {
            // Don't set loading to false here - polling will handle it
        }
    };

    // Write to Delta Table - Parse uploaded files and write to delta table
    const handleWriteToDeltaTable = async () => {
        try {
            // Get all uploaded files' UC paths
            const uploadedFiles = selectedFiles.filter(file => file.isUploaded && file.ucPath);
            const filePaths = uploadedFiles.map(file => file.ucPath!);
            
            if (filePaths.length === 0) {
                throw new Error("No uploaded files found. Please upload files first.");
            }
            
            console.log("Calling writeToDeltaTable with files:", filePaths);
            
            // Call the new polling-based function - this handles everything
            await writeToDeltaTable(filePaths);
            
        } catch (error) {
            console.error("Error in handleWriteToDeltaTable:", error);
            setDeltaTableError(error instanceof Error ? error.message : String(error));
        }
    };

    const OLD_handleWriteToDeltaTable_REMOVE = async () => {
        // This is old code that should be removed
        try {
            const response = await apiCall("/api/write-to-delta-table", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: filePaths,
                    limit: 10
                })
            });
            
            if (response.success && response.data) {
                setDeltaTableResults(response.data);
                setShowDeltaTableResults(true);
                console.log(`Successfully processed ${response.data.length} table entries`);
            } else {
                // If the operation reports failure but we can see the UI shows table data,
                // try to query the table directly as a fallback
                console.log("Write operation reported failure, but checking if table has data...");
                try {
                    const queryResponse = await apiCall("/api/query-delta-table", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            file_paths: filePaths,
                            limit: 10
                        })
                    });
                    
                    if (queryResponse.success && queryResponse.data && queryResponse.data.length > 0) {
                        console.log(`Found ${queryResponse.data.length} table entries via fallback query`);
                        setDeltaTableResults(queryResponse.data);
                        setShowDeltaTableResults(true);
                        // Clear error since we successfully recovered the data
                        setDeltaTableError(null);
                        // Log the warning to console instead of showing it as an error
                        console.warn(`Write operation reported issues (${response.message}) but recovered ${queryResponse.data.length} existing table entries.`);
                    } else {
                        setDeltaTableError(response.message || "No data returned from operation");
                        setDeltaTableResults([]);
                    }
                } catch (queryError) {
                    console.error("Fallback query also failed:", queryError);
                    setDeltaTableError(response.message || "No data returned from operation");
                    setDeltaTableResults([]);
                }
            }
            
        } catch (error) {
            console.error("Delta table write error:", error);
            
            // Handle timeout errors with user-friendly message
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('504') || errorMessage.includes('timeout') || errorMessage.includes('upstream request timeout')) {
                errorMessage = "The operation is taking longer than expected. Large documents may need more time to process. Please be patient.";
            } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
                errorMessage = "There was a server error processing your document. Please check your file and configuration, then try again.";
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                errorMessage = "Network error occurred. Please check your connection and try again.";
            }
            
            setDeltaTableError(errorMessage);
            setDeltaTableResults([]);
        } finally {
            setDeltaTableLoading(false);
        }
    };

    const queryDeltaTableResults = async () => {
        console.log("Querying delta table results for files:", processedSessionFiles);
        
        if (processedSessionFiles.length === 0) {
            console.log("No processed files in session, skipping query");
            setDeltaTableResults([]);
            return;
        }

        setDeltaTableLoading(true);
        setDeltaTableError(null);

        try {
            const response = await apiCall("/api/query-delta-table", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: processedSessionFiles,
                    limit: 20
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Delta table query failed");
            }

            const result = await response.json();
            console.log("Delta table query result:", result);
            
            if (result.success) {
                setDeltaTableResults(result.data || []);
                console.log(`Set ${result.data?.length || 0} delta table results`);
            } else {
                throw new Error(result.error || result.message || "Query failed");
            }

        } catch (error) {
            console.error("Delta table query error:", error);
            
            // Handle timeout errors with user-friendly message
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('504') || errorMessage.includes('timeout') || errorMessage.includes('upstream request timeout')) {
                errorMessage = "The query is taking longer than expected. Please by patient.";
            } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
                errorMessage = "There was a server error querying your data. Please check your configuration and try again.";
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                errorMessage = "Network error occurred. Please check your connection and try again.";
            }
            
            setDeltaTableError(errorMessage);
            setDeltaTableResults([]);
        } finally {
            setDeltaTableLoading(false);
        }
    };

    const handleGenerateExcel = async () => {
        try {
            setExcelGenerationError(null);
            setExcelGenerationLoading(true);
            setExcelGenerationSuccess(false);
            
            // Get all uploaded files' paths
            const uploadedFiles = selectedFiles.filter(file => file.isUploaded && file.ucPath);
            const filePaths = uploadedFiles.map(file => file.ucPath!);
            
            if (filePaths.length === 0) {
                throw new Error("No uploaded files found. Please upload and process files first.");
            }
            
            if (deltaTableResults.length === 0) {
                throw new Error("No table data found. Please write to Delta Table first.");
            }
            
            console.log("Generating Excel files for:", filePaths);
            
            const result = await apiCall("/api/generate-excel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: filePaths
                })
            });

            // apiCall already returns parsed JSON, not a Response object
            console.log("Excel generation result:", result);
            
            if (result.success && result.generated_files) {
                setGeneratedExcelFiles(result.generated_files);
                setExcelGenerationSuccess(true);
                console.log(`Successfully generated ${result.generated_files.length} Excel files`);
            } else {
                setExcelGenerationError(result.message || "No Excel files were generated");
                setGeneratedExcelFiles([]);
            }
            
        } catch (error) {
            console.error("Excel generation error:", error);
            setExcelGenerationError(error instanceof Error ? error.message : String(error));
            setGeneratedExcelFiles([]);
        } finally {
            setExcelGenerationLoading(false);
        }
    };

    const handleDownloadExcel = async (filePath: string, fileName: string) => {
        try {
            console.log(`Downloading Excel file: ${fileName} from ${filePath}`);
            
            // Create download URL with file path as query parameter
            const downloadUrl = `/api/download-excel?file_path=${encodeURIComponent(filePath)}`;
            
            // Create a temporary link element to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`Download initiated for ${fileName}`);
            
        } catch (error) {
            console.error("Excel download error:", error);
            // Could add error state here if needed
        }
    };

    const renderDeltaTableResults = () => {
        if (deltaTableLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Writing to delta table and retrieving results...</span>
                </div>
            );
        }

        if (deltaTableError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        <span className="font-medium text-red-700">Delta Table Error</span>
                    </div>
                    <p className="text-red-700 text-sm">{deltaTableError}</p>
                </div>
            );
        }

        if (deltaTableResults.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Database className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No table extraction results yet.</p>
                    <p className="text-sm">Upload documents and click "Write to Delta Table" to extract tables.</p>
                    <p className="text-xs mt-2 text-gray-400">
                        Results will show data inserted into: {deltaTablePathConfig.delta_table_path}
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                    Showing {deltaTableResults.length} extracted tables from delta table: {deltaTablePathConfig.delta_table_path}
                </div>
                {deltaTableResults.map((result, index) => (
                    <div key={index} className="border rounded p-4 bg-gray-50">
                        <div className="font-medium text-sm mb-2 text-blue-600">
                            {result.table_name || `Table ${result.table_id}`}
                        </div>
                        <div className="text-xs text-gray-500 mb-3 space-y-1">
                            <div>File: {result.path?.split('/').pop() || 'Unknown file'}</div>
                            <div>Page: {result.page_id !== undefined ? result.page_id : 'Unknown'}</div>
                            <div>Table ID: {result.table_id}</div>
                        </div>
                        
                        {/* Table Content Display */}
                        <div className="mb-3">
                            <div className="font-medium text-xs text-green-600 mb-1">Table Content (ai_parse_document):</div>
                            <div className="bg-white p-3 rounded border text-sm max-h-64 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-mono text-xs">
                                    {result.table || 'No table content available'}
                                </pre>
                            </div>
                        </div>
                        
                        {/* Metadata */}
                        <div className="text-xs text-gray-400 bg-gray-100 p-2 rounded">
                            <strong>Extraction Info:</strong> Extracted table from page {result.page_id !== undefined ? result.page_id : 'N/A'} using ai_parse_document function
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderSummarizeResults = () => {
        if (summarizeLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Generating summary...</span>
                </div>
            );
        }

        if (summarizeError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        <span className="font-medium text-red-700">Summarize Error</span>
                    </div>
                    <p className="text-red-700 text-sm">{summarizeError}</p>
                </div>
            );
        }

        if (!summarizeResults) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Lightbulb className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No summary yet.</p>
                    <p className="text-sm">Click "Summarize" to generate a summary of the document.</p>
                </div>
            );
        }

        return (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                <div className="flex items-start mb-4">
                    <div className="bg-blue-100 rounded-full p-2 mr-3 flex-shrink-0">
                        <Lightbulb className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">Document Summary</h3>
                        <p className="text-gray-800 leading-relaxed">
                            {summarizeResults}
                        </p>
                    </div>
                </div>
                
                <div className="bg-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
                    <div className="flex items-center mb-2">
                        <span className="text-blue-700 font-semibold text-sm">💡 Powered by Databricks AI Functions</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                        This summary was automatically generated using the{' '}
                        <code className="bg-blue-200 px-1 rounded text-xs">ai_summarize(content, 200)</code>{' '}
                        function. This demonstrates how you can extract key insights from documents at scale using simple SQL commands.
                    </p>
                </div>
            </div>
        );
    };

    const renderExtractResults = () => {
        if (extractLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Extracting information using AI...</span>
                </div>
            );
        }

        if (extractError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        <span className="font-medium text-red-700">Extract Error</span>
                    </div>
                    <p className="text-red-700 text-sm">{extractError}</p>
                </div>
            );
        }

        if (!extractResults) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <FileText className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No extract results yet.</p>
                    <p className="text-sm">Add labels and click Extract to see results here.</p>
                </div>
            );
        }

        try {
            const parsed = typeof extractResults === 'string' ? JSON.parse(extractResults) : extractResults;
            
            return (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                            <div className="bg-green-100 rounded-full p-2 mr-3">
                                <FileText className="h-5 w-5 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-800">Extracted Information</h3>
                        </div>
                        
                        <div className="text-sm text-green-700 mb-4">
                            Extracted using enhanced ai_extract() with {labels.length} custom labels
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(parsed).map(([key, value], index) => (
                                <div key={index} className="bg-white p-4 rounded border border-green-100">
                                    <div className="font-semibold text-sm text-green-700 mb-2 capitalize">
                                        {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-sm text-gray-800">
                                        {typeof value === 'string' ? value : JSON.stringify(value)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 text-xs text-green-600 bg-green-50 rounded p-2">
                            <strong>💡 Extraction Summary:</strong> Successfully extracted {Object.keys(parsed).length} data points 
                            using AI functions. This demonstrates how custom labels can be used to extract specific information 
                            from documents at scale.
                        </div>
                    </div>
                </div>
            );
        } catch (e) {
            return (
                <div className="bg-gray-50 p-4 rounded text-xs">
                    <h5 className="font-medium text-gray-600 mb-2">Raw Extract Result:</h5>
                    <pre className="whitespace-pre-wrap text-xs overflow-x-auto">{JSON.stringify(extractResults, null, 2)}</pre>
                </div>
            );
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };


    const activeFile = activeFileIndex !== null ? selectedFiles[activeFileIndex] : null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Value Proposition Modal */}
            {showValueModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-3xl font-bold text-blue-600 flex items-center">
                                    <FileText className="mr-3 h-8 w-8" />
                                    Databricks AI Functions: Transform Document Processing
                                </h2>
                                <button 
                                    onClick={() => setShowValueModal(false)}
                                    className="text-gray-500 hover:text-gray-700 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-l-4 border-blue-500">
                                    <h3 className="text-xl font-semibold mb-3 text-blue-700">🎯 The Challenge: Document Intelligence at Scale</h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        Modern organizations process thousands of documents daily—PDFs, contracts, invoices, reports—requiring 
                                        complex AI workflows to extract, analyze, and understand content. Traditional approaches involve multiple 
                                        tools, APIs, and manual processing that don't scale with enterprise document volumes.
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                                        <h4 className="font-semibold text-red-700 mb-3">❌ Traditional Approach</h4>
                                        <ul className="text-sm text-red-600 space-y-2">
                                            <li>• Multiple document processing APIs</li>
                                            <li>• Complex OCR and parsing pipelines</li>
                                            <li>• Security risks with external services</li>
                                            <li>• Manual file handling and storage</li>
                                            <li>• Inconsistent extraction quality</li>
                                            <li>• Limited scalability for enterprise volumes</li>
                                        </ul>
                                    </div>
                                    
                                    <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                                        <h4 className="font-semibold text-green-700 mb-3">✅ Databricks AI Functions</h4>
                                        <ul className="text-sm text-green-600 space-y-2">
                                            <li>• Simple SQL: ai_parse_document(file_path)</li>
                                            <li>• Built-in Unity Catalog file storage</li>
                                            <li>• Data never leaves your secure environment</li>
                                            <li>• Native lakehouse integration</li>
                                            <li>• Consistent, reliable AI parsing</li>
                                            <li>• Seamless scaling to thousands of documents</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border-l-4 border-purple-500">
                                    <h3 className="text-xl font-semibold mb-4 text-purple-700">🚀 Demo Journey: Single Document → Enterprise Scale</h3>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-semibold text-purple-600 mb-2">Interactive Prototype</h4>
                                            <p className="text-sm text-gray-700 mb-3">
                                                Upload any document type and see how ai_parse_document extracts structured content 
                                                with headers, footers, and intelligent parsing.
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-purple-600 mb-2">Production Pipeline</h4>
                                            <p className="text-sm text-gray-700 mb-3">
                                                Scale the same workflow to process <strong>entire document libraries</strong> 
                                                with automated batch processing using Lakeflow.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border-l-4 border-yellow-500">
                                    <h3 className="text-xl font-semibold mb-3 text-yellow-700">💰 Scale Impact</h3>
                                    <div className="grid md:grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-600">1000x</div>
                                            <div className="text-sm text-gray-600">Scale from 1 to enterprise volumes</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-600">95%</div>
                                            <div className="text-sm text-gray-600">Less integration complexity</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-600">Zero</div>
                                            <div className="text-sm text-gray-600">External API dependencies</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-600 text-white p-6 rounded-lg">
                                    <h3 className="text-xl font-semibold mb-3">🎬 Ready to Experience Document Intelligence?</h3>
                                    <p className="mb-4">
                                        This interactive demo showcases the complete document processing journey from individual file upload 
                                        to enterprise-scale document intelligence using Databricks AI Functions.
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm opacity-90">
                                            Upload documents → Parse with AI → Extract structured data → Scale to production
                                        </div>
                                        <button 
                                            onClick={() => setShowValueModal(false)}
                                            className="bg-white text-blue-600 px-6 py-2 rounded font-semibold hover:bg-gray-100 transition-colors"
                                        >
                                            Start Demo →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="flex items-center justify-between px-8 py-4">
                    <Link href="/" className="flex items-center text-blue-600 hover:text-blue-800 font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        back to main menu
                    </Link>
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={() => setShowWarehouseConfig(!showWarehouseConfig)}
                            className="flex items-center text-gray-600 hover:text-gray-800 text-sm font-medium"
                            title="Configure Databricks Warehouse"
                        >
                            <Settings className="w-4 h-4 mr-1" />
                            Settings
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">PDF to Excel Generator</h1>
                    </div>
                </div>
            </header>

            {/* Warehouse Configuration Section */}
            {showWarehouseConfig && (
                <div className="bg-gray-100 border-b border-gray-200 p-6">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Database className="mr-2 h-5 w-5" />
                                Databricks Warehouse Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Databricks SQL Warehouse ID for AI Functions used in document processing. Each user may have a different warehouse ID.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Warehouse ID
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border flex-1 font-mono">
                                        {warehouseConfig.warehouse_id || 'Loading...'}
                                    </div>
                                    {warehouseConfig.warehouse_id !== warehouseConfig.default_warehouse_id && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Custom</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Update Warehouse ID
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newWarehouseId}
                                        onChange={(e) => setNewWarehouseId(e.target.value)}
                                        placeholder="Enter your warehouse ID (e.g., 3708ab0cd3e20acd)"
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button 
                                        onClick={updateWarehouseConfig}
                                        disabled={warehouseLoading || !newWarehouseId.trim() || newWarehouseId === warehouseConfig.warehouse_id}
                                        size="sm"
                                        className="flex items-center"
                                    >
                                        {warehouseLoading ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {warehouseSuccess && (
                                <div className="flex items-center text-green-600 text-sm">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Warehouse ID updated successfully! Document processing AI Functions will now use the new warehouse.
                                </div>
                            )}

                            <div className="border-t pt-4 mt-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Test AI Functions</h4>
                                <Button 
                                    onClick={testAiFunctions}
                                    disabled={aiTestLoading}
                                    size="sm"
                                    variant="outline"
                                    className="mb-3"
                                >
                                    {aiTestLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Testing...
                                        </>
                                    ) : (
                                        "Test AI Functions"
                                    )}
                                </Button>
                                
                                {aiTestResult && (
                                    <div className={`p-2 rounded text-sm ${
                                        aiTestResult.success 
                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                            : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                        {aiTestResult.message}
                                    </div>
                                )}
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <h4 className="text-sm font-medium text-blue-800 mb-1">How to find your Warehouse ID:</h4>
                                <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                                    <li>Go to your Databricks workspace</li>
                                    <li>Navigate to "SQL Warehouses" in the sidebar</li>
                                    <li>Click on your warehouse name</li>
                                    <li>Copy the ID from the URL or warehouse details</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Volume Path Configuration */}
                    <Card className="max-w-2xl mx-auto mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Database className="mr-2 h-5 w-5" />
                                Databricks Volume Path Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Databricks UC Volume path for document storage and processing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Volume Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border flex-1 font-mono">
                                        {volumePathConfig.volume_path || 'Loading...'}
                                    </div>
                                    {volumePathConfig.volume_path !== volumePathConfig.default_volume_path && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Custom</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Update Volume Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newVolumePath}
                                        onChange={(e) => setNewVolumePath(e.target.value)}
                                        placeholder="Enter your volume path (e.g., /Volumes/catalog/schema/volume/)"
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button 
                                        onClick={updateVolumePathConfig}
                                        disabled={volumePathLoading || !newVolumePath.trim() || newVolumePath === volumePathConfig.volume_path}
                                        size="sm"
                                        className="flex items-center"
                                    >
                                        {volumePathLoading ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {volumePathSuccess && (
                                <div className="flex items-center text-green-600 text-sm">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Volume path updated successfully! Document uploads will now use the new path.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Delta Table Path Configuration */}
                    <Card className="max-w-2xl mx-auto mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Database className="mr-2 h-5 w-5" />
                                Databricks Delta Table Path Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Databricks Delta table path for storing parsed document results.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Delta Table Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border flex-1 font-mono">
                                        {deltaTablePathConfig.delta_table_path || 'Loading...'}
                                    </div>
                                    {deltaTablePathConfig.delta_table_path !== deltaTablePathConfig.default_delta_table_path && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Custom</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Update Delta Table Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newDeltaTablePath}
                                        onChange={(e) => setNewDeltaTablePath(e.target.value)}
                                        placeholder="Enter your delta table path (e.g., /catalog.schema.table_name)"
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button 
                                        onClick={updateDeltaTablePathConfig}
                                        disabled={deltaTablePathLoading || !newDeltaTablePath.trim() || newDeltaTablePath === deltaTablePathConfig.delta_table_path}
                                        size="sm"
                                        className="flex items-center"
                                    >
                                        {deltaTablePathLoading ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {deltaTablePathSuccess && (
                                <div className="flex items-center text-green-600 text-sm">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Delta table path updated successfully! Parsed results will now be stored in the new table.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <main className="flex flex-col lg:flex-row gap-8 p-8 h-[calc(100vh-120px)]">
                {/* Left Panel: File Management - 1/4 width */}
                <div className="lg:w-1/4 flex flex-col gap-4 overflow-y-auto pr-2">
                    <h2 className="text-lg font-semibold text-center">Document Processing</h2>
                    
                    {/* File Upload Card */}
                    <Card className="h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select Documents
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsFileUploadCollapsed(!isFileUploadCollapsed)}
                                    className="h-6 w-6 p-0"
                                >
                                    {isFileUploadCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CardTitle>
                            {!isFileUploadCollapsed && (
                                <CardDescription className="text-sm">
                                    Select files from your local system to preview and process with AI
                                </CardDescription>
                            )}
                        </CardHeader>
                        {!isFileUploadCollapsed && (
                            <CardContent className="pt-0">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".txt,.pdf,.doc,.docx,.csv,.json,.jpg,.jpeg,.png"
                                />
                                <Button onClick={handleFileSelect} className="w-full text-sm">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select Files to Upload
                                </Button>
                            </CardContent>
                        )}
                    </Card>

                    {/* Selected Files Card */}
                    {selectedFiles.length > 0 && (
                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Database className="mr-2 h-4 w-4" />
                                        Selected Files ({selectedFiles.length})
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsSelectedFilesCollapsed(!isSelectedFilesCollapsed)}
                                        className="h-6 w-6 p-0"
                                    >
                                        {isSelectedFilesCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isSelectedFilesCollapsed && (
                                    <CardDescription className="text-sm">
                                        Click to preview a file, then use Upload to upload to UC Volume
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isSelectedFilesCollapsed && (
                                <CardContent className="space-y-2 pt-0">
                                {selectedFiles.map((file, index) => (
                                    <div 
                                        key={index} 
                                        className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${
                                            activeFileIndex === index ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        <div 
                                            className="flex items-center flex-1 min-w-0"
                                            onClick={() => handleFilePreview(index)}
                                        >
                                            <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-sm truncate">{file.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {formatFileSize(file.size)} • {file.type}
                                                    {file.isUploaded && <span className="text-green-600 ml-2">✓ Uploaded</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleFilePreview(index)}
                                                disabled={file.isProcessing}
                                            >
                                                <Eye className="h-4 w-4" />
                                                Preview
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleProcessFile(index)}
                                                disabled={file.isProcessing || file.isUploaded}
                                                className="min-w-[80px]"
                                            >
                                                {file.isProcessing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : file.isUploaded ? (
                                                    "Uploaded"
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4 mr-1" />
                                                        Upload
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                </CardContent>
                            )}
                        </Card>
                    )}



                    {/* Write to Delta Table Panel - Shows after upload like other panels */}
                    {selectedFiles.length > 0 && (
                        <Card className="h-fit bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Database className="mr-2 h-5 w-5 text-blue-600" />
                                        Write to Delta Table
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsDeltaTableResultsCollapsed(!isDeltaTableResultsCollapsed)}
                                        className="h-6 w-6 p-0"
                                    >
                                        {isDeltaTableResultsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isDeltaTableResultsCollapsed && (
                                    <CardDescription className="text-sm">
                                        Parse uploaded documents with ai_parse_document to extract table data and write to Delta Table for persistent storage and querying.
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isDeltaTableResultsCollapsed && (
                                <CardContent className="space-y-3 pt-0">
                                    {selectedFiles.filter(f => f.isUploaded).length > 0 && (
                                        <div className="p-3 bg-white rounded border">
                                            <div className="text-sm font-medium text-gray-700 mb-2">
                                                Uploaded Files: {selectedFiles.filter(f => f.isUploaded).length} file(s)
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                {selectedFiles.filter(f => f.isUploaded).slice(0, 3).map((file, i) => (
                                                    <div key={i} className="font-mono">{file.name}</div>
                                                ))}
                                                {selectedFiles.filter(f => f.isUploaded).length > 3 && (
                                                    <div className="text-gray-500">+ {selectedFiles.filter(f => f.isUploaded).length - 3} more files</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleWriteToDeltaTable}
                                        disabled={deltaTableLoading || selectedFiles.filter(f => f.isUploaded).length === 0}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                        size="lg"
                                    >
                                        {deltaTableLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Writing to Delta Table...
                                            </>
                                        ) : (
                                            <>
                                                <Database className="h-4 w-4 mr-2" />
                                                Write to Delta Table
                                            </>
                                        )}
                                    </Button>

                                    {selectedFiles.filter(f => f.isUploaded).length === 0 && (
                                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded text-center">
                                            Upload documents first to write to Delta Table
                                        </div>
                                    )}

                                    {deltaTableError && (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                            {deltaTableError}
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-red-700 text-sm">{error}</span>
                        </div>
                    )}
                </div>

                {/* Right Panel: File Preview and Results - 3/4 width */}
                <div className="lg:w-3/4 flex flex-col gap-6 overflow-y-auto pl-2">
                    <h2 className="text-xl font-semibold text-center">Preview & Results</h2>
                    
                    {/* Delta Table Results Card - Shows first when available */}
                    {showDeltaTableResults && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Database className="mr-2 h-5 w-5 text-blue-600" />
                                        Delta Table Results
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsDeltaTableResultsCollapsed(!isDeltaTableResultsCollapsed)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {isDeltaTableResultsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isDeltaTableResultsCollapsed && (
                                    <CardDescription>
                                        Processed document results from ai_parse_document function stored in Delta table.
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isDeltaTableResultsCollapsed && (
                                <CardContent>
                                    {renderDeltaTableResults()}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Generate Excel File Panel - Shows when Delta table results exist */}
                    {deltaTableResults.length > 0 && showDeltaTableResults && (
                        <Card className="h-fit bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Download className="mr-2 h-5 w-5 text-green-600" />
                                        Generate Excel File
                                    </div>
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    Convert extracted table data to Excel files with separate sheets for each table.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0">
                                {selectedFiles.filter(f => f.isUploaded).length > 0 && (
                                    <div className="p-3 bg-white rounded border">
                                        <div className="text-sm font-medium text-gray-700 mb-2">
                                            Ready to Generate: {selectedFiles.filter(f => f.isUploaded).length} Excel file(s)
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            {selectedFiles.filter(f => f.isUploaded).slice(0, 3).map((file, i) => (
                                                <div key={i} className="font-mono">{file.name.replace(/\.[^/.]+$/, ".xlsx")}</div>
                                            ))}
                                            {selectedFiles.filter(f => f.isUploaded).length > 3 && (
                                                <div className="text-gray-500">+ {selectedFiles.filter(f => f.isUploaded).length - 3} more files</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleGenerateExcel}
                                    disabled={excelGenerationLoading || deltaTableResults.length === 0 || selectedFiles.filter(f => f.isUploaded).length === 0}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    size="lg"
                                >
                                    {excelGenerationLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Generating Excel Files...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4 mr-2" />
                                            Generate Excel File
                                        </>
                                    )}
                                </Button>

                                {excelGenerationError && (
                                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                        {excelGenerationError}
                                    </div>
                                )}

                                {excelGenerationSuccess && generatedExcelFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                                            ✓ Successfully generated {generatedExcelFiles.length} Excel file(s)
                                        </div>
                                        <div className="space-y-1">
                                            {generatedExcelFiles.map((file, index) => (
                                                <div key={index} className="text-xs bg-white p-2 rounded border">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="font-medium text-gray-800">{file.excel_name}</div>
                                                            <div className="text-gray-600">
                                                                {file.tables_count} table{file.tables_count !== 1 ? 's' : ''} • Ready for download
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={() => handleDownloadExcel(file.excel_file, file.excel_name)}
                                                            size="sm"
                                                            className="ml-2 bg-green-600 hover:bg-green-700 text-white px-2 py-1 h-6 text-xs"
                                                        >
                                                            <Download className="h-3 w-3 mr-1" />
                                                            Download
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* File Preview Card */}
                    <Card className="flex-1">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <Eye className="mr-2 h-5 w-5" />
                                    Document Preview
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsDocumentPreviewCollapsed(!isDocumentPreviewCollapsed)}
                                    className="h-8 w-8 p-0"
                                >
                                    {isDocumentPreviewCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CardTitle>
                            {!isDocumentPreviewCollapsed && (
                                <CardDescription>
                                    {activeFile ? `Previewing: ${activeFile.name}` : "Select a file to preview its content"}
                                </CardDescription>
                            )}
                        </CardHeader>
                        {!isDocumentPreviewCollapsed && (
                            <CardContent>
                                {activeFile?.preview ? (
                                    <div className="w-full h-[600px]">
                                        {activeFile.preview === "PDF_PREVIEW" && activeFile.previewUrl ? (
                                            <iframe
                                                src={activeFile.previewUrl}
                                                className="w-full h-full border rounded"
                                                title={`Preview of ${activeFile.name}`}
                                            />
                                        ) : activeFile.preview === "IMAGE_PREVIEW" && activeFile.previewUrl ? (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-50 border rounded">
                                                <img
                                                    src={activeFile.previewUrl}
                                                    alt={`Preview of ${activeFile.name}`}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 p-4 rounded border h-full overflow-y-auto">
                                                <pre className="text-sm whitespace-pre-wrap font-mono">{activeFile.preview}</pre>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[600px] text-gray-500">
                                        <div className="text-center">
                                            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                                            <p>Select a file to preview its content</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>


                </div>
            </main>
        </div>
    );
} 