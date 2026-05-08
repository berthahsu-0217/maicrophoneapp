import { makeUploadScoreTool } from './shared';

export function makeLongToneTools(userId?: string) {
    return {
        uploadScore: makeUploadScoreTool(userId, ['stability']),
    };
}
