import type { Role } from "@/lib/types";

/**
 * Qui voit quoi dans « Stages & opportunités ».
 * Garder ces deux listes identiques à APPLICANTS / RECRUITERS de backend/routes/opportunityRoutes.js
 * (le backend est la vraie barrière ; ici on ne fait que masquer ce que le rôle ne peut pas utiliser).
 */
export const APPLICANT_ROLES: readonly Role[] = ["STUDENT"]; // postulent, onglet « Où j'ai postulé »
export const RECRUITER_ROLES: readonly Role[] = ["COMPANY", "ADMIN"]; // publient des offres, onglet « Demandes »

export const canApply = (role?: Role): boolean => !!role && APPLICANT_ROLES.includes(role);
export const canManage = (role?: Role): boolean => !!role && RECRUITER_ROLES.includes(role);
