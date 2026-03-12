import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, Image, ActivityIndicator } from 'react-native';
import { ExternalLink, FileText, MapPin, Globe } from 'lucide-react-native';

// ─── Helpers ───────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const PDF_REGEX = /\.pdf(\?.*)?$/i;
const MAP_REGEX = /\/maps\/|google\.com\/maps|maps\.apple\.com/i;

export function extractFirstUrl(text: string): string | null {
    const matches = text.match(URL_REGEX);
    return matches?.[0] ?? null;
}

export function detectContentType(url: string): 'pdf' | 'map' | 'link' {
    if (PDF_REGEX.test(url)) return 'pdf';
    if (MAP_REGEX.test(url)) return 'map';
    return 'link';
}

// ─── PDF Preview ────────────────────────────────────────────
function PdfPreview({ url }: { url: string }) {
    const filename = url.split('/').pop()?.split('?')[0] || 'documento.pdf';
    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fef2f2',
                borderWidth: 1,
                borderColor: '#fecaca',
                borderRadius: 12,
                padding: 12,
                marginTop: 6,
                gap: 10,
            }}
        >
            <View style={{ width: 40, height: 40, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }} numberOfLines={1}>{filename}</Text>
                <Text style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Tocca per aprire il PDF</Text>
            </View>
            <ExternalLink size={16} color="#ef4444" />
        </TouchableOpacity>
    );
}

// ─── Map Preview ─────────────────────────────────────────────
function MapPreview({ url }: { url: string }) {
    // Extract coordinates from map URL if possible
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const lat = coordMatch?.[1];
    const lng = coordMatch?.[2];

    // Static map image via OpenStreetMap tile (no API key needed)
    const mapThumbUrl = lat && lng
        ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=300x150&markers=${lat},${lng}`
        : null;

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            style={{
                borderRadius: 12,
                overflow: 'hidden',
                marginTop: 6,
                borderWidth: 1,
                borderColor: '#d1fae5',
            }}
        >
            {mapThumbUrl ? (
                <Image source={{ uri: mapThumbUrl }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
            ) : (
                <View style={{ backgroundColor: '#d1fae5', height: 80, alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={28} color="#065f46" />
                </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#ecfdf5', gap: 6 }}>
                <MapPin size={14} color="#065f46" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#065f46', flex: 1 }} numberOfLines={1}>
                    Apri posizione in Maps
                </Text>
                <ExternalLink size={13} color="#065f46" />
            </View>
        </TouchableOpacity>
    );
}

// ─── Link Open Graph Preview ───────────────────────────────
interface OGData {
    title: string;
    description: string;
    image: string | null;
    domain: string;
}

function LinkPreview({ url }: { url: string }) {
    const [og, setOg] = useState<OGData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const domain = new URL(url).hostname.replace('www.', '');

        // Use a free OG proxy service (jsonlink.io - no API key needed)
        fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                setOg({
                    title: data.title || domain,
                    description: data.description || '',
                    image: data.images?.[0] || null,
                    domain,
                });
            })
            .catch(() => {
                if (!cancelled) setOg({ title: domain, description: '', image: null, domain });
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [url]);

    if (loading) {
        return (
            <View style={{ marginTop: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', height: 60, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#94a3b8" />
            </View>
        );
    }

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            style={{
                marginTop: 6,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                backgroundColor: '#f8fafc',
            }}
        >
            {og?.image && (
                <Image source={{ uri: og.image }} style={{ width: '100%', height: 130 }} resizeMode="cover" />
            )}
            <View style={{ padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Globe size={11} color="#94a3b8" />
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }}>{og?.domain}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }} numberOfLines={2}>{og?.title}</Text>
                {!!og?.description && (
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 3 }} numberOfLines={2}>{og?.description}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ─── Main Export ────────────────────────────────────────────
interface MessageRichPreviewProps {
    /** The raw message text to scan for URLs */
    text: string;
}

export function MessageRichPreview({ text }: MessageRichPreviewProps) {
    const url = extractFirstUrl(text);
    if (!url) return null;

    const type = detectContentType(url);

    if (type === 'pdf') return <PdfPreview url={url} />;
    if (type === 'map') return <MapPreview url={url} />;
    return <LinkPreview url={url} />;
}
