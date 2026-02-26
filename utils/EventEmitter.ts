type Callback = (data?: any) => void;

class EventEmitter {
    private events: { [key: string]: Callback[] } = {};

    on(event: string, callback: Callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event: string, callback: Callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event: string, data?: any) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => callback(data));
    }
}

export const SyncEvents = {
    SYNC_USERS: 'SYNC_USERS',
    SYNC_ACTIVITIES: 'SYNC_ACTIVITIES',
    SYNC_APPLICATIONS: 'SYNC_APPLICATIONS',
    SYNC_REVIEWS: 'SYNC_REVIEWS',
};

export const eventEmitter = new EventEmitter();
