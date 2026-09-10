export function matchingPrefixLength(currentText: string, presetContent: string): number {
    const limit = Math.min(currentText.length, presetContent.length);
    let index = 0;

    while (index < limit && currentText[index] === presetContent[index]) {
        index++;
    }

    return index;
}

export function advancePresetIndex(currentIndex: number, currentText: string, presetContent: string): number {
    return Math.max(currentIndex, matchingPrefixLength(currentText, presetContent));
}
