let pendingIntroVideo = false;

export function queueIntroVideoTransition() {
    pendingIntroVideo = true;
}

export function consumeIntroVideoTransition() {
    if (!pendingIntroVideo) return false;
    pendingIntroVideo = false;
    return true;
}
