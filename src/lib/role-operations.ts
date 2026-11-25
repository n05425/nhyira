import type { AccessOperation } from "@/lib/role-governance";
import { getSection } from "@/lib/finance-config";

// Explicit server-controlled identity; callers cannot select their own permission target.
export const SERVER_OPERATIONS: Record<string, { resource: string; actions: AccessOperation[] }> = {
  "reports:getReportOptions": { resource: "termly-reports", actions: ["read"] },
  "reports:getTermlyReport": { resource: "termly-reports", actions: ["read"] },
  "admin:listAccounts": { resource: "user-management", actions: ["read"] },
  "admin:createAccount": { resource: "user-management", actions: ["create"] },
  "admin:updateAccount": { resource: "user-management", actions: ["update"] },
  "admin:setAccountStatus": { resource: "user-management", actions: ["update"] },
  "admin:deleteAccount": { resource: "user-management", actions: ["delete"] },
  "admin:bulkImportAccounts": { resource: "user-management", actions: ["import", "create"] },
  "admin:adminResetPassword": { resource: "user-management", actions: ["update"] },
  "admin:listResetRequests": { resource: "user-management", actions: ["read"] },
  "admin:resolveResetRequest": { resource: "user-management", actions: ["update"] },
  "admin:deleteResetRequest": { resource: "user-management", actions: ["delete"] },
  "admin:listAuditLogs": { resource: "user-management", actions: ["read"] },
  "admin:clearAuditLogs": { resource: "user-management", actions: ["delete"] },
  "admin:getSecuritySettings": { resource: "user-management", actions: ["read"] },
  "admin:saveSecuritySettings": { resource: "user-management", actions: ["update"] },
  "admin:forcePasswordChangeAll": { resource: "user-management", actions: ["update"] },
  "admin:lockAllAccounts": { resource: "user-management", actions: ["update"] },
  "admin:getUserVerificationData": { resource: "user-verification", actions: ["read"] },
  "admissions:getAdmissionsOverview": { resource: "admissions", actions: ["read"] },
  "admissions:createAdmission": { resource: "admissions", actions: ["create"] },
  "admissions:updateAdmission": { resource: "admissions", actions: ["update"] },
  "admissions:deleteAdmission": { resource: "admissions", actions: ["delete"] },
  "admissions:saveClassTeacher": { resource: "admissions", actions: ["read"] },
  "admissions:recordExeat": { resource: "admissions", actions: ["create"] },
  "admissions:getMyChildren": { resource: "my-children", actions: ["read"] },
  "admissions:getChildDetail": { resource: "my-children", actions: ["read"] },
  "assessment:getAssessmentContext": { resource: "assessment", actions: ["read"] },
  "assessment:getAssessmentStudents": { resource: "assessment", actions: ["read"] },
  "assessment:listAssessments": { resource: "assessment", actions: ["read"] },
  "assessment:saveAssessment": { resource: "assessment", actions: ["create", "update"] },
  "assessment:deleteAssessment": { resource: "assessment", actions: ["delete"] },
  "assignments:getTeacherScopeData": { resource: "assignments", actions: ["read"] },
  "assignments:listAssignments": { resource: "assignments", actions: ["read"] },
  "assignments:getAssignmentDetails": { resource: "assignments", actions: ["read"] },
  "assignments:saveAssignment": { resource: "assignments", actions: ["create", "update"] },
  "assignments:deleteAssignment": { resource: "assignments", actions: ["delete"] },
  "assignments:manageAssignmentGroups": { resource: "assignments", actions: ["create"] },
  "assignments:submitAssignment": { resource: "assignments", actions: ["create"] },
  "assignments:gradeSubmission": { resource: "assignments", actions: ["update"] },
  "assignments:requestRegrade": { resource: "assignments", actions: ["create"] },
  "assignments:reviewRegradeRequest": { resource: "assignments", actions: ["update"] },
  "attendance:getAttendanceAccess": { resource: "attendance", actions: ["read"] },
  "attendance:getAttendanceClasses": { resource: "attendance", actions: ["read"] },
  "attendance:getClassRegister": { resource: "attendance", actions: ["read"] },
  "attendance:saveAttendance": { resource: "attendance", actions: ["read"] },
  "attendance:getAttendanceHistory": { resource: "attendance", actions: ["read"] },
  "exams:listExams": { resource: "exams-quizzes", actions: ["read"] },
  "exams:getExamDetails": { resource: "exams-quizzes", actions: ["read"] },
  "exams:saveExam": { resource: "exams-quizzes", actions: ["create", "update"] },
  "exams:deleteExam": { resource: "exams-quizzes", actions: ["delete"] },
  "exams:startExamAttempt": { resource: "exams-quizzes", actions: ["create"] },
  "exams:submitExamAnswers": { resource: "exams-quizzes", actions: ["update"] },
  "exams:gradeSubmission": { resource: "exams-quizzes", actions: ["update"] },
  "exams:syncExamToAssessment": { resource: "exams-quizzes", actions: ["read"] },
  "exams:listSubmissions": { resource: "exams-quizzes", actions: ["read"] },
  "fees-invoicing:getFeesInvoicingOverview": { resource: "fees-invoicing", actions: ["read"] },
  "fees-invoicing:executeBillingRun": { resource: "fees-invoicing", actions: ["create"] },
  "fees-invoicing:recordFeePayment": { resource: "fees-invoicing", actions: ["create"] },
  "fees-invoicing:applyFeeAdjustment": { resource: "fees-invoicing", actions: ["update"] },
  "finance:getFinancialOverview": { resource: "financial-management", actions: ["read"] },
  "finance:addIncome": { resource: "financial-management", actions: ["create"] },
  "finance:addExpense": { resource: "financial-management", actions: ["create"] },
  "finance:addPayrollEntry": { resource: "financial-management", actions: ["create"] },
  "finance:importStaffPayroll": { resource: "financial-management", actions: ["import", "create"] },
  "finance:processPayroll": { resource: "financial-management", actions: ["update"] },
  "finance:addStudentFee": { resource: "financial-management", actions: ["create"] },
  "finance:updateStudentFee": { resource: "financial-management", actions: ["update"] },
  "finance:deleteFinanceRecord": { resource: "financial-management", actions: ["delete"] },
  "invoices:getInvoicesOverview": { resource: "invoices", actions: ["read"] },
  "invoices:recordInvoicePayment": { resource: "invoices", actions: ["create"] },
  "invoices:issueInvoice": { resource: "invoices", actions: ["create"] },
  "invoices:voidInvoice": { resource: "invoices", actions: ["update"] },
  "lessons:listLessons": { resource: "lessons", actions: ["read"] },
  "lessons:getMyTeachingScope": { resource: "lessons", actions: ["read"] },
  "lessons:listAvailableQuizzes": { resource: "lessons", actions: ["read"] },
  "lessons:getLessonDetails": { resource: "lessons", actions: ["read"] },
  "lessons:saveLesson": { resource: "lessons", actions: ["create", "update"] },
  "lessons:deleteLesson": { resource: "lessons", actions: ["delete"] },
  "lessons:completeLesson": { resource: "lessons", actions: ["update"] },
  "library:getLibraryOverviewStats": { resource: "library", actions: ["read"] },
  "library:listLibraryBooks": { resource: "library", actions: ["read"] },
  "library:getLibraryBookDetails": { resource: "library", actions: ["read"] },
  "library:saveLibraryBook": { resource: "library", actions: ["create", "update"] },
  "library:deleteLibraryBook": { resource: "library", actions: ["delete"] },
  "library:autoPopulateBorrowerInfo": { resource: "library", actions: ["read"] },
  "library:listLibraryLoans": { resource: "library", actions: ["read"] },
  "library:issueLibraryLoan": { resource: "library", actions: ["create"] },
  "library:returnLibraryLoan": { resource: "library", actions: ["update"] },
  "library:renewLibraryLoan": { resource: "library", actions: ["update"] },
  "library:payLoanFine": { resource: "library", actions: ["update"] },
  "library:listLibraryReservations": { resource: "library", actions: ["read"] },
  "library:reserveLibraryBook": { resource: "library", actions: ["create"] },
  "library:cancelLibraryReservation": { resource: "library", actions: ["delete"] },
  "messaging:getMessagingConfigAndRules": { resource: "messaging", actions: ["read"] },
  "messaging:getAnnouncements": { resource: "messaging", actions: ["read"] },
  "messaging:upsertAnnouncement": { resource: "messaging", actions: ["create", "update"] },
  "messaging:deleteAnnouncement": { resource: "messaging", actions: ["delete"] },
  "messaging:markAnnouncementRead": { resource: "messaging", actions: ["update"] },
  "messaging:getConversations": { resource: "messaging", actions: ["read"] },
  "messaging:getDirectMessages": { resource: "messaging", actions: ["read"] },
  "messaging:startConversation": { resource: "messaging", actions: ["create"] },
  "messaging:sendDirectMessage": { resource: "messaging", actions: ["create"] },
  "messaging:markConversationRead": { resource: "messaging", actions: ["update"] },
  "messaging:getEligibleRecipients": { resource: "messaging", actions: ["read"] },
  "performance-tracker:getPerformanceTrackerOverview": { resource: "performance-tracker", actions: ["read"] },
  "performance-tracker:getLongitudinalProgressData": { resource: "performance-tracker", actions: ["read"] },
  "performance-tracker:getCrossAnalyticsData": { resource: "performance-tracker", actions: ["read"] },
  "performance-tracker:getAtRiskStudentsData": { resource: "performance-tracker", actions: ["read"] },
  "performance-tracker:getStudentAcademicProfile": { resource: "performance-tracker", actions: ["read"] },
  "performance-tracker:createInterventionPlan": { resource: "performance-tracker", actions: ["create"] },
  "performance-tracker:updateInterventionPlan": { resource: "performance-tracker", actions: ["update"] },
  "performance-tracker:addInterventionNote": { resource: "performance-tracker", actions: ["create"] },
  "performance-tracker:updatePerformanceRiskRules": { resource: "performance-tracker", actions: ["update"] },
  "publicity:getPublicityNotices": { resource: "publicity", actions: ["read"] },
  "publicity:upsertPublicityNotice": { resource: "publicity", actions: ["create", "update"] },
  "publicity:deletePublicityNotice": { resource: "publicity", actions: ["delete"] },
  "publicity:getPublicityCirculars": { resource: "publicity", actions: ["read"] },
  "publicity:upsertPublicityCircular": { resource: "publicity", actions: ["create", "update"] },
  "publicity:deletePublicityCircular": { resource: "publicity", actions: ["delete"] },
  "publicity:getPublicityBanners": { resource: "publicity", actions: ["read"] },
  "publicity:upsertPublicityBanner": { resource: "publicity", actions: ["create", "update"] },
  "publicity:deletePublicityBanner": { resource: "publicity", actions: ["delete"] },
  "publicity:getPublicityArticles": { resource: "publicity", actions: ["read"] },
  "publicity:upsertPublicityArticle": { resource: "publicity", actions: ["create", "update"] },
  "publicity:deletePublicityArticle": { resource: "publicity", actions: ["delete"] },
  "publicity:getPublicityMediaGallery": { resource: "publicity", actions: ["read"] },
  "publicity:upsertPublicityMediaGallery": { resource: "publicity", actions: ["create", "update"] },
  "publicity:deletePublicityMediaGallery": { resource: "publicity", actions: ["delete"] },
  "results:getResultsPublicationStatus": { resource: "results", actions: ["read"] },
  "results:updateResultPublication": { resource: "results", actions: ["update"] },
  "results:getBroadsheetData": { resource: "results", actions: ["read"] },
  "results:getStudentTranscript": { resource: "results", actions: ["read"] },
  "staff:getStaffOverview": { resource: "staff-management", actions: ["read"] },
  "staff:createPerformanceReview": { resource: "staff-management", actions: ["create"] },
  "staff:deletePerformanceReview": { resource: "staff-management", actions: ["delete"] },
  "staff:createSchedule": { resource: "staff-management", actions: ["create"] },
  "staff:deleteSchedule": { resource: "staff-management", actions: ["delete"] },
  "staff:createOfferLetter": { resource: "staff-management", actions: ["create"] },
  "staff:setOfferStatus": { resource: "staff-management", actions: ["update"] },
  "staff:deleteOfferLetter": { resource: "staff-management", actions: ["delete"] },
  "students:getStudentsOverview": { resource: "students", actions: ["read"] },
  "students:getStudentFullDetail": { resource: "students", actions: ["read"] },
  "students:updateStudentDetail": { resource: "students", actions: ["update"] },
  "students:updateStudentClass": { resource: "students", actions: ["update"] },
  "students:recordStudentExeat": { resource: "students", actions: ["create"] },
  "timetable:listTimetableSlots": { resource: "timetable", actions: ["read"] },
  "timetable:getTimetableAutoPopulationData": { resource: "timetable", actions: ["read"] },
  "timetable:saveTimetableSlot": { resource: "timetable", actions: ["create", "update"] },
  "timetable:deleteTimetableSlot": { resource: "timetable", actions: ["delete"] },
  "archives:getArchiveSummary": { resource: "archives", actions: ["read"] },
  "archives:getArchiveRecords": { resource: "archives", actions: ["read"] },
  "archives:exportArchiveRecords": { resource: "archives", actions: ["read", "export"] },
  "offer-letter:getAppointmentLetter": { resource: "staff-management", actions: ["read"] },
  "teaching:listTeachingAssignments": { resource: "user-management", actions: ["read"] },
  "teaching:getTeachingAssignments": { resource: "user-management", actions: ["read"] },
  "finance-config:getFinanceConfiguration": { resource: "financial-configuration", actions: ["read"] },
  "finance-config:saveFinanceSection": { resource: "financial-configuration", actions: ["read"] },
  "finance-config:setFinanceSectionStatus": { resource: "financial-configuration", actions: ["update"] },
  "finance-config:saveFinanceItem": { resource: "financial-configuration", actions: ["create", "update"] },
  "finance-config:saveFinanceRule": { resource: "financial-configuration", actions: ["create", "update"] },
  "finance-config:deleteFinanceConfigRow": { resource: "financial-configuration", actions: ["delete"] },
  "finance-config:seedFinanceDefaults": { resource: "financial-configuration", actions: ["create"] },
  "config:getConfiguration": { resource: "system-configuration", actions: ["read"] },
  "config:createSchool": { resource: "system-configuration", actions: ["create"] },
  "config:updateSchool": { resource: "system-configuration", actions: ["update"] },
  "config:deleteSchool": { resource: "system-configuration", actions: ["delete"] },
  "config:createEducationLevel": { resource: "system-configuration", actions: ["create"] },
  "config:createSchoolType": { resource: "system-configuration", actions: ["create"] },
  "config:createSubject": { resource: "system-configuration", actions: ["create"] },
  "config:deleteSubject": { resource: "system-configuration", actions: ["delete"] },
  "config:saveTenantSettings": { resource: "system-configuration", actions: ["update"] },
  "config:saveBranding": { resource: "system-configuration", actions: ["update"] },
  "config:saveAdmissionNumbering": { resource: "operations-configuration", actions: ["update"] },
  "config:saveEmployeeNumbering": { resource: "system-configuration", actions: ["update"] },
  "config:getSchoolOperationsSettings": { resource: "operations-configuration", actions: ["read"] },
  "config:saveOperationsRules": { resource: "operations-configuration", actions: ["update"] },
  "config:createSchoolClass": { resource: "system-configuration", actions: ["create"] },
  "config:updateSchoolClass": { resource: "system-configuration", actions: ["update"] },
  "config:deleteSchoolClass": { resource: "system-configuration", actions: ["delete"] },
  "config:getSchoolCalendar": { resource: "academic-configuration", actions: ["read"] },
  "config:saveAcademicCalendar": { resource: "academic-configuration", actions: ["update"] },
  "config:getSchoolAcademicSettings": { resource: "academic-configuration", actions: ["read"] },
  "config:saveAcademicSettings": { resource: "academic-configuration", actions: ["update"] },
  "config:getSchoolPeopleSettings": { resource: "people-configuration", actions: ["read"] },
  "config:savePeopleSettings": { resource: "people-configuration", actions: ["update"] },
};

// Shared pickers/session/recovery and Super-Admin-only governance retain their own guards.
export const OPERATION_EXEMPTIONS = new Set([
  "admin:recordLogin", "admin:changeOwnPassword", "admin:getPortalOverview", "admin:setMyAvatar",
  "config:getOperationsRules", "config:getTenantOptions", "config:getSubjectOptions", "config:getSubjectCatalog",
  "config:getSchoolClasses", "config:getAcademicCalendar", "config:getAcademicRules", "config:getPeopleRules",
  "finance-config:getActiveFinanceConfig", "teaching:getMyTeachingScope",
  "role-governance:getRoleGovernance", "role-governance:mutateRoleGovernance",
  "role-governance:getMyRoleAccess", "role-governance:getMyPortalProfile", "role-governance:authorizeModuleExport",
  "publicity:getPublicLandingData",
]);

export function operationKey(meta: { filename: string; name: string }) {
  const stem = meta.filename.split("?")[0]?.replace(/\\/g, "/").match(/([^/]+)\.functions\.[tj]sx?$/)?.[1];
  return stem ? `${stem}:${meta.name}` : null;
}

export function financePermissionResource(sectionKey: string) {
  const section = getSection(sectionKey);
  if (!section) throw new Error("Unknown configuration permission target.");
  return section.area.owner ?? "financial-configuration";
}

export function serverOperation(meta: { filename: string; name: string }, data: unknown) {
  const key = operationKey(meta);
  if (!key) return null;
  const registered = SERVER_OPERATIONS[key];
  if (!registered) return null;
  let operation = { ...registered, actions: [...registered.actions] };
  const input = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (key === "finance-config:getFinanceConfiguration") {
    const owner = input['owner'] ?? "financial-configuration";
    if (owner !== "financial-configuration" && owner !== "reporting-configuration") throw new Error("Unknown configuration owner.");
    operation = { ...operation, resource: owner };
  }
  if (["finance-config:saveFinanceSection", "finance-config:saveFinanceItem", "finance-config:saveFinanceRule"].includes(key)) {
    const target = input['sectionKey'] ?? input['listKey'] ?? input['ruleKey'];
    if (typeof target !== "string") throw new Error("Missing configuration permission target.");
    operation = { ...operation, resource: financePermissionResource(target) };
  }
  const idEditors = new Set(["saveAssessment", "saveFinanceRule", "saveExam", "saveAssignment", "saveLesson", "saveLibraryBook", "saveTimetableSlot", "saveFinanceItem", "upsertAnnouncement", "upsertPublicityNotice", "upsertPublicityCircular", "upsertPublicityBanner", "upsertPublicityArticle", "upsertPublicityMediaGallery"]);
  if (idEditors.has(meta.name)) return { ...operation, actions: [input['id'] ? "update" : "create"] as AccessOperation[] };
  return operation;
}

export type OperationRequirement = { resource: string; actions: AccessOperation[] };

/** UI controls reuse the server registry; the projection is never proof of authorization. */
export function requirementsForOperation(key: string, data: unknown = {}): OperationRequirement[] {
  const [stem, name, extra] = key.split(":");
  if (!stem || !name || extra) return [];
  return serverRequirements({ filename: `${stem}.functions.ts`, name }, data);
}

export function projectedOperationAllowed(
  projection: readonly { moduleId: string; actions: readonly AccessOperation[] }[], key: string, data: unknown = {},
): boolean {
  try {
    const requirements = requirementsForOperation(key, data);
    return requirements.length > 0 && requirements.every((r) => r.actions.every((action) =>
      projection.some((p) => p.moduleId === r.resource && p.actions.includes(action))));
  } catch { return false; }
}

/** Every cross-module side effect is registered here, never in a module's permission code. */
export function serverRequirements(meta: { filename: string; name: string }, data: unknown): OperationRequirement[] {
  const operation = serverOperation(meta, data);
  if (!operation) return [];
  const input = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const key = operationKey(meta);
  const requirements = [operation];
  if ((["assignments:gradeSubmission", "assignments:reviewRegradeRequest"].includes(key ?? "") && input['syncToAssessment'] === true) || key === "exams:syncExamToAssessment")
    requirements.push({ resource: "assessment", actions: ["create"] });
  return requirements;
}

/** Trusted record facts are supplied after the handler reads its rows; permission policy stays here. */
export function recordSaveRequirements(
  key: string, data: unknown, facts: { additions: number; edits: number },
): OperationRequirement[] {
  if (!["attendance:saveAttendance", "admissions:saveClassTeacher", "finance-config:saveFinanceSection"].includes(key))
    throw new Error("No registered record-save permission policy.");
  if (!Number.isInteger(facts.additions) || !Number.isInteger(facts.edits) || facts.additions < 0 || facts.edits < 0)
    throw new Error("Invalid record-save facts.");
  const [stem, name] = key.split(":");
  if (!stem || !name) throw new Error("Invalid record-save policy.");
  const operation = serverOperation({ filename: `${stem}.functions.ts`, name }, data);
  if (!operation) throw new Error("No registered record-save permission policy.");
  return [{ resource: operation.resource, actions: ["read", ...(facts.additions ? ["create" as const] : []), ...(facts.edits ? ["update" as const] : [])] }];
}
