export interface ActivityFilters {
    category?: string;
    searchText?: string;
    skills?: string[];
    onlyAvailable?: boolean;
    onlyUrgent?: boolean;
    dateFrom?: string;
    dateTo?: string;
    centerLat?: number;
    centerLng?: number;
    radiusKm?: number;
    statuses?: string[];
}

