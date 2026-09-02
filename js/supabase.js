import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zrzxfaqaolbnamwqehcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenhmYXFhb2xibmFtd3FlaGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMDAxMzYsImV4cCI6MjEwMzc3NjEzNn0.we474U5racM-47W9v5WjBmO0iCrj26yKZwA31DLTomo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper for session ID persistence
export function getSessionId() {
    let sid = localStorage.getItem('cchoice_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('cchoice_session_id', sid);
    }
    return sid;
}

// Fetch saved addresses for the current session
export async function getSavedAddresses() {
    const sessionId = getSessionId();
    const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching saved addresses:', error);
        return [];
    }
    return data || [];
}

// Save a new address
export async function saveAddress(label, addressText, lat, lng) {
    const sessionId = getSessionId();
    const { data, error } = await supabase
        .from('saved_addresses')
        .insert([{
            session_id: sessionId,
            label,
            address_text: addressText,
            lat: parseFloat(lat),
            lng: parseFloat(lng)
        }])
        .select();

    if (error) {
        console.error('Error saving address:', error);
        throw error;
    }
    return data[0];
}

// Delete a saved address by ID
export async function deleteAddress(id) {
    const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting address:', error);
        throw error;
    }
}

// Fetch delivery history log
export async function getDeliveryHistory() {
    const sessionId = getSessionId();
    const { data, error } = await supabase
        .from('delivery_history')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching delivery history:', error);
        return [];
    }
    return data || [];
}

// Save completed or ongoing delivery run
export async function saveDeliveryRecord(record) {
    const sessionId = getSessionId();
    const { data, error } = await supabase
        .from('delivery_history')
        .insert([{
            session_id: sessionId,
            restaurant_name: record.restaurantName,
            destination_address: record.destinationAddress,
            origin_lat: parseFloat(record.originLat),
            origin_lng: parseFloat(record.originLng),
            dest_lat: parseFloat(record.destLat),
            dest_lng: parseFloat(record.destLng),
            distance_km: parseFloat(record.distanceKm),
            duration_mins: parseFloat(record.durationMins),
            status: record.status || 'completed'
        }])
        .select();

    if (error) {
        console.error('Error saving delivery record:', error);
        return null;
    }
    return data[0];
}
