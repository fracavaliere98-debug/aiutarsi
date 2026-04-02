import React, { createRef, useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ArrowRight, Clapperboard, Copy, FolderOpen, Image as ImageIcon, Layers3, Sparkles, Video } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { StandardLayout } from '../../components/StandardLayout';
import { SoftCard } from '../../components/SoftCard';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/Colors';
import { useToast } from '../../context/ToastContext';
import { MarketingFramePreview } from '../../components/marketing/MarketingFramePreview';
import {
    MARKETING_EXPORT_ROOT,
    MARKETING_VIDEO_DIR,
    isDirectlyNavigableMarketingRoute,
    marketingFrameSpecs,
    marketingSplineWorkflow,
    marketingVideoSpecs,
    type MarketingFrameSpec,
} from '../../utils/marketingFrames';
import { isProductionRuntime } from '../../utils/runtimeConfig';

function RouteBadge({ label }: { label: string }) {
    return (
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#eef2ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#4338ca', fontSize: 11, fontWeight: '800' }}>{label}</Text>
        </View>
    );
}

function FrameCard({
    frame,
    previewRef,
    onOpen,
    onCopyFilename,
}: {
    frame: MarketingFrameSpec;
    previewRef: React.RefObject<View>;
    onOpen: () => void;
    onCopyFilename: () => void;
}) {
    const canOpen = isDirectlyNavigableMarketingRoute(frame.route);

    return (
        <SoftCard className="p-5 mb-4">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.primary, fontSize: 18, fontWeight: '900', marginBottom: 6 }}>
                        {frame.title}
                    </Text>
                    <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 21 }}>
                        {frame.description}
                    </Text>
                </View>
                <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 10 }}>
                    <ImageIcon size={20} color={Colors.primary} />
                </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <RouteBadge label={frame.category.toUpperCase()} />
                <RouteBadge label={`Spline: ${frame.splineScene}`} />
                <RouteBadge label={`Format: ${frame.aspectHint}`} />
            </View>

            <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: '#f8fafc', padding: 14 }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>
                    Filename
                </Text>
                <Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '800' }}>
                    {frame.filename}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                    Route: {frame.route}
                </Text>
            </View>

            <View style={{ marginTop: 14 }} ref={previewRef} collapsable={false}>
                <MarketingFramePreview preview={frame.preview} />
            </View>

            <View style={{ marginTop: 14 }}>
                {frame.notes.map((note) => (
                    <Text key={`${frame.id}_${note}`} style={{ color: '#475569', fontSize: 13, lineHeight: 20, marginBottom: 4 }}>
                        • {note}
                    </Text>
                ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                    onPress={onOpen}
                    disabled={!canOpen}
                    activeOpacity={0.88}
                    style={{
                        flex: 1,
                        backgroundColor: canOpen ? Colors.primary : '#cbd5e1',
                        borderRadius: 18,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                >
                    <ArrowRight size={16} color="white" />
                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>
                        {canOpen ? 'Apri schermata' : 'Inserisci activity-id'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onCopyFilename}
                    activeOpacity={0.88}
                    style={{
                        paddingHorizontal: 16,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: '#dbe4ff',
                        backgroundColor: '#f8faff',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Copy size={16} color={Colors.primary} />
                </TouchableOpacity>
            </View>
        </SoftCard>
    );
}

export default function MarketingCaptureScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const isProd = isProductionRuntime();
    const fileSystemModule = FileSystem as unknown as { documentDirectory?: string | null };
    const documentDirectory = fileSystemModule.documentDirectory ?? null;
    const previewRefs = useMemo(() => {
        return Object.fromEntries(marketingFrameSpecs.map((frame) => [frame.id, createRef<View>()])) as Record<string, React.RefObject<View>>;
    }, []);

    const groupedFrames = useMemo(() => {
        return marketingFrameSpecs.reduce<Record<string, MarketingFrameSpec[]>>((acc, frame) => {
            if (!acc[frame.category]) {
                acc[frame.category] = [];
            }
            acc[frame.category].push(frame);
            return acc;
        }, {});
    }, []);

    if (isProd) {
        return <Redirect href="/" />;
    }

    const copyText = async (text: string, message: string) => {
        await Clipboard.setStringAsync(text);
        showToast('success', message);
    };

    const ensureExportFolders = async () => {
        if (!documentDirectory) {
            throw new Error('documentDirectory unavailable');
        }

        const base = `${documentDirectory}marketing`;
        const screens = `${base}/screens`;
        const videos = `${base}/videos`;
        await FileSystem.makeDirectoryAsync(base, { intermediates: true });
        await FileSystem.makeDirectoryAsync(screens, { intermediates: true });
        await FileSystem.makeDirectoryAsync(videos, { intermediates: true });
        return { base, screens, videos };
    };

    const exportFrame = async (frame: MarketingFrameSpec) => {
        const targetRef = previewRefs[frame.id]?.current;
        if (!targetRef) {
            showToast('error', 'Preview non disponibile per questo frame');
            return;
        }

        try {
            const { screens } = await ensureExportFolders();
            const tempUri = await captureRef(targetRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });
            const destination = `${screens}/${frame.filename}`;
            await FileSystem.copyAsync({ from: tempUri, to: destination });
            showToast('success', `PNG esportato in ${destination.replace(documentDirectory || '', '')}`);
        } catch (error) {
            console.error('Marketing export error:', error);
            showToast('error', 'Esportazione PNG fallita');
        }
    };

    const exportAllFrames = async () => {
        let completed = 0;

        for (const frame of marketingFrameSpecs) {
            const targetRef = previewRefs[frame.id]?.current;
            if (!targetRef) continue;

            try {
                const { screens } = await ensureExportFolders();
                const tempUri = await captureRef(targetRef, {
                    format: 'png',
                    quality: 1,
                    result: 'tmpfile',
                });
                const destination = `${screens}/${frame.filename}`;
                await FileSystem.copyAsync({ from: tempUri, to: destination });
                completed += 1;
            } catch (error) {
                console.error(`Marketing batch export error for ${frame.id}:`, error);
            }
        }

        if (completed === marketingFrameSpecs.length) {
            showToast('success', `Fatti screenshot: ${completed}/${marketingFrameSpecs.length}`);
        } else {
            showToast('warning', `Screenshot completati: ${completed}/${marketingFrameSpecs.length}`);
        }
    };

    return (
        <StandardLayout
            title="Marketing Capture"
            label="Dev Tools"
            onBack={() => router.back()}
            bg="bg-background-light"
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
                <SoftCard className="p-5 mb-5">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={20} color={Colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: Colors.primary, fontSize: 18, fontWeight: '900' }}>
                                Pipeline Spline per AiutarSi
                            </Text>
                            <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                                Usa questa schermata per scegliere i frame, aprire i target screen e uniformare gli export.
                            </Text>
                        </View>
                    </View>

                    {marketingSplineWorkflow.map((step, index) => (
                        <Text key={step} style={{ color: '#475569', fontSize: 13, lineHeight: 20, marginBottom: 6 }}>
                            {index + 1}. {step}
                        </Text>
                    ))}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <Button
                            title="Fai screenshot"
                            variant="accent"
                            className="flex-1"
                            onPress={exportAllFrames}
                        />
                        <TouchableOpacity
                            onPress={() => copyText('hero-device, stack-devices', 'Preset Spline copiati')}
                            activeOpacity={0.88}
                            style={{
                                paddingHorizontal: 14,
                                borderRadius: 18,
                                backgroundColor: '#f8fafc',
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Layers3 size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => copyText(MARKETING_EXPORT_ROOT, 'Cartella export copiata')}
                            activeOpacity={0.88}
                            style={{
                                paddingHorizontal: 14,
                                borderRadius: 18,
                                backgroundColor: '#f8fafc',
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <FolderOpen size={18} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                </SoftCard>

                <SoftCard className="p-5 mb-6">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <FolderOpen size={18} color={Colors.primary} />
                        <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '900' }}>
                            Asset Folder Convention
                        </Text>
                    </View>
                    <Text style={{ color: '#475569', fontSize: 13, lineHeight: 20 }}>
                        assets/marketing/screens/ per i PNG grezzi, assets/marketing/exports/ per gli output video o sequence da Spline.
                    </Text>
                    <Text style={{ color: '#475569', fontSize: 13, lineHeight: 20, marginTop: 6 }}>
                        Usa sempre suffix incrementali come v1, v2, v3 per evitare overwrite tra varianti creative.
                    </Text>
                    <Text style={{ color: '#475569', fontSize: 13, lineHeight: 20, marginTop: 6 }}>
                        Export automatici salvati localmente in: marketing/screens e marketing/videos dentro la document directory dell&apos;app.
                    </Text>
                </SoftCard>

                {Object.entries(groupedFrames).map(([category, frames]) => (
                    <View key={category} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Clapperboard size={18} color={Colors.primary} />
                            <Text style={{ color: Colors.primary, fontSize: 17, fontWeight: '900', textTransform: 'capitalize' }}>
                                {category}
                            </Text>
                        </View>

                        {frames.map((frame) => (
                            <View key={frame.id}>
                                <FrameCard
                                    frame={frame}
                                    previewRef={previewRefs[frame.id]}
                                    onOpen={() => {
                                        if (isDirectlyNavigableMarketingRoute(frame.route)) {
                                            router.push(frame.route as any);
                                            return;
                                        }
                                        showToast('info', 'Apri manualmente una activity specifica e usa il filename suggerito');
                                    }}
                                    onCopyFilename={() => copyText(frame.filename, 'Filename export copiato')}
                                />
                                <View style={{ marginTop: -6, marginBottom: 18 }}>
                                    <Button
                                        title="Fai screenshot singolo"
                                        onPress={() => exportFrame(frame)}
                                        variant="outline"
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                ))}

                <SoftCard className="p-5 mt-2 mb-10">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <Video size={18} color={Colors.primary} />
                        <Text style={{ color: Colors.primary, fontSize: 17, fontWeight: '900' }}>
                            Mini Video Ready
                        </Text>
                    </View>
                    <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                        Oltre agli screenshot, la pipeline ora prepara anche mini video da esportare in Spline o montare in Jitter.
                    </Text>
                    {marketingVideoSpecs.map((videoSpec) => (
                        <View
                            key={videoSpec.id}
                            style={{
                                backgroundColor: '#f8fafc',
                                borderRadius: 20,
                                padding: 14,
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                marginBottom: 10,
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: '900' }}>
                                        {videoSpec.title}
                                    </Text>
                                    <Text style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                                        {videoSpec.durationSeconds}s · {videoSpec.scenePreset} · {videoSpec.outputName}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => copyText(videoSpec.captions.join('\n'), 'Shotlist mini video copiata')}
                                    activeOpacity={0.88}
                                    style={{ padding: 10, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }}
                                >
                                    <Copy size={15} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <View style={{ marginTop: 10 }}>
                                {videoSpec.captions.map((caption) => (
                                    <Text key={`${videoSpec.id}_${caption}`} style={{ color: '#475569', fontSize: 13, lineHeight: 19, marginBottom: 4 }}>
                                        • {caption}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    ))}
                    <View style={{ marginTop: 6 }}>
                        <Button
                            title="Copia cartella video"
                            variant="outline"
                            onPress={() => copyText(MARKETING_VIDEO_DIR, 'Cartella video copiata')}
                        />
                    </View>
                </SoftCard>
            </ScrollView>
        </StandardLayout>
    );
}
