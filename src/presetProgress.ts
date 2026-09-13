export function matchingPrefixLength(currentText: string, presetContent: string): number {
    let currentIndex = 0;
    let presetIndex = 0;

    while (currentIndex < currentText.length && presetIndex < presetContent.length) {
        const currentNewlineLength = newlineLengthAt(currentText, currentIndex);
        const presetNewlineLength = newlineLengthAt(presetContent, presetIndex);

        if (currentNewlineLength > 0 && presetNewlineLength > 0) {
            currentIndex += currentNewlineLength;
            presetIndex += presetNewlineLength;
            continue;
        }

        if (currentText[currentIndex] !== presetContent[presetIndex]) {
            break;
        }

        currentIndex++;
        presetIndex++;
    }

    return presetIndex;
}

function newlineLengthAt(text: string, index: number): number {
    if (text[index] === '\r' && text[index + 1] === '\n') {
        return 2;
    }

    return text[index] === '\n' ? 1 : 0;
}

export function advancePresetIndex(currentIndex: number, currentText: string, presetContent: string): number {
    return Math.max(currentIndex, matchingPrefixLength(currentText, presetContent));
}
