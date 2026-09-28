import { ImocModelSummary, ImocTicket, ImocTicketLookup, ImocTicketPage, ImocTicketSearch } from '../../domain/entity/imoc.entity';
type ImocFetch = (input: string, init: RequestInit) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;
export interface IImocTokenProvider {
    readonly configured: boolean;
    getToken(): Promise<string>;
    invalidate(): void;
}
export interface ImocMachineTokenOptions {
    baseUrl: string;
    tenantId?: string;
    tenantAccount?: string;
    machineUserAccount?: string;
    accessKey?: string;
    secretKey?: string;
    timeoutMs: number;
    refreshSkewMs: number;
}
export interface IImocClient {
    readonly enabled: boolean;
    readonly configured: boolean;
    listTickets(query: ImocTicketSearch): Promise<ImocTicketPage>;
    getTicket(lookup: ImocTicketLookup): Promise<ImocTicket>;
    getLightweightTickets(orderIds: string[]): Promise<ImocTicket[]>;
    getTicketStatus(orderNumber: string): Promise<ImocTicket>;
    getCurrentTicketStatus(orderNumber: string): Promise<ImocTicket>;
    getModel(modelId: string): Promise<ImocModelSummary>;
}
/**
 * Applies for and caches the documented IMOC machine-machine token. Credentials
 * are read from deployment configuration only; neither credentials nor tokens
 * are persisted, logged, returned by IAMS, or sent to the frontend.
 */
export declare class MachineUserImocTokenProvider implements IImocTokenProvider {
    private readonly options;
    private readonly fetchImpl;
    private readonly now;
    private token;
    private expiresAtMs;
    private refreshInFlight;
    readonly configured: boolean;
    constructor(options: ImocMachineTokenOptions, fetchImpl?: ImocFetch, now?: () => number);
    getToken(): Promise<string>;
    invalidate(): void;
    private _applyForToken;
}
export declare const createImocClient: () => IImocClient;
export {};
//# sourceMappingURL=imoc.client.d.ts.map