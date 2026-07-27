import jsPDF from "jspdf";
import type { DetectionMetrics } from "../lib/detector";
import type { FactDensityResult } from "./factDensityAnalyzer";
import type { PlagiarismResult } from "./plagiarismDetector";

export interface AuditReportData {
  documentTitle: string;
  userName: string;
  userRole: string;
  originalText: string;
  initialMetrics: DetectionMetrics;
  finalMetrics?: DetectionMetrics;
  semanticScore?: number;
  factDensity?: FactDensityResult;
  plagiarism?: PlagiarismResult;
  llmSignature: string;
}

export async function generateAuditReport(data: AuditReportData) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  
  // Generate SHA-256 hash of the original text
  const encoder = new TextEncoder();
  const dataBuf = encoder.encode(data.originalText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55); // Gold
  doc.text("OLIGENS DETECTOR - CERTIFICAT D'AUDIT, DE PLAGIAT & D'INTÉGRITÉ SÉMANTIQUE", 10, y);
  
  y += 15;
  
  // User Details
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Document: ${data.documentTitle || "Untitled"}`, 10, y);
  y += 7;
  doc.text(`Utilisateur: ${data.userName || "N/A"} (${data.userRole || "N/A"})`, 10, y);
  y += 7;
  doc.text(`Date: ${new Date().toLocaleString()}`, 10, y);
  
  y += 15;
  
  // Cryptographic Evidence
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Empreinte Cryptographique (SHA-256 du texte source):", 10, y);
  y += 5;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.text(hashHex, 10, y);
  
  y += 15;
  
  // AI Profiling
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Profilage LLM & Analyse Forensique", 10, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Signature Détectée: ${data.llmSignature}`, 10, y);
  y += 7;
  doc.text(`Probabilité IA initiale: ${Math.round(data.initialMetrics.aiScore * 100)}%`, 10, y);
  
  if (data.finalMetrics) {
    y += 7;
    doc.text(`Probabilité IA finale: ${Math.round(data.finalMetrics.aiScore * 100)}%`, 10, y);
  }
  if (data.semanticScore !== undefined) {
    y += 7;
    doc.text(`Taux d'Intégrité Sémantique: ${Math.round(data.semanticScore * 100)}%`, 10, y);
  }
  
  y += 15;
  
  // Fact Density
  if (data.factDensity) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Bilan de Densité Factuelle", 10, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Indice de Densité Factuelle: ${data.factDensity.factDensityIndex.toFixed(1)}% (${data.factDensity.status})`, 10, y);
    y += 7;
    doc.text(`Entités Concrètes: ${data.factDensity.entitiesFound}`, 10, y);
    y += 15;
  }
  
  // Plagiarism & Footnote Audit
  if (data.plagiarism) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Taux de Plagiat & Conformité des Notes", 10, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Taux de Plagiat (Non attribué): ${data.plagiarism.plagiarismScore.toFixed(1)}%`, 10, y);
    y += 10;
    
    // List some sentences
    doc.setFontSize(8);
    const flagged = data.plagiarism.sentences.filter(s => s.citationStatus !== "None").slice(0, 5);
    for (const f of flagged) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(`Status: ${f.citationStatus} - "${f.text.substring(0, 100)}..."`, 10, y);
      y += 6;
    }
    y += 10;
  }
  
  // Signature block
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Official Stamp / Signature block for academic or legal compliance:", 10, y);
  y += 10;
  doc.setDrawColor(0);
  doc.line(10, y, 70, y);
  y += 5;
  doc.text("Authorized Signature", 10, y);
  
  doc.save(`Oligens-Audit-Report-${Date.now()}.pdf`);
}
