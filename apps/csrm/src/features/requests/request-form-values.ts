import type { CsrmAssessmentRequest } from './request-domain';
import type { RequestDraftInput } from './request-schema';

export function toRequestFormValues(request: CsrmAssessmentRequest): RequestDraftInput {
  return {
    title: request.title,
    description: request.description ?? '',
    assessmentType: request.assessmentType ?? undefined,
    division: request.division ?? '',
    businessUnit: request.businessUnit ?? '',
    businessPurpose: request.businessPurpose ?? '',
    businessCriticality: request.businessCriticality ?? undefined,
    thirdPartyInvolvement: request.thirdPartyInvolvement ?? false,
    thirdPartyDetails: request.thirdPartyDetails ?? '',
    regulatoryRequirements: request.regulatoryRequirements ?? '',
    dueDate: request.dueDate ?? undefined,
    informationSystems: request.informationSystems.map(({ documentId }) => documentId),
    informationAssets: request.informationAssets.map(({ documentId }) => documentId),
  };
}
