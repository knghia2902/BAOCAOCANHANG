// Visitor Tracking Service
// Tracks unique visitors using localStorage to avoid duplicate counts

const VISITOR_KEY = 'portfolio_visitor_tracked';
const VISIT_EXPIRY_DAYS = 30; // Count as new visitor after 30 days

export const VisitorTracker = {
    /**
     * Check if this visitor has been counted recently
     */
    hasVisited(): boolean {
        const lastVisit = localStorage.getItem(VISITOR_KEY);
        if (!lastVisit) return false;

        const lastVisitTime = parseInt(lastVisit, 10);
        const now = Date.now();
        const expiryTime = VISIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        // If last visit was more than VISIT_EXPIRY_DAYS ago, count as new visitor
        return (now - lastVisitTime) < expiryTime;
    },

    /**
     * Mark this visitor as counted
     */
    markVisited(): void {
        localStorage.setItem(VISITOR_KEY, Date.now().toString());
    },

    /**
     * Track a new visitor (call this on app mount)
     */
    async trackVisit(incrementFn: () => Promise<boolean>): Promise<void> {
        if (!this.hasVisited()) {
            const success = await incrementFn();
            if (success) {
                this.markVisited();
                console.log('📊 New visitor tracked');
            }
        } else {
            console.log('👋 Returning visitor');
        }
    }
};
