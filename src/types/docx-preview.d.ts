declare module 'docx-preview' {
    export interface Options {
        inWrapper?: boolean;
        ignoreWidth?: boolean;
        ignoreHeight?: boolean;
        ignoreFonts?: boolean;
        breakPages?: boolean;
        debug?: boolean;
        experimental?: boolean;
        className?: string;
        trimXmlDeclaration?: boolean;
        useWindowWatermark?: boolean;
        renderHeaders?: boolean;
        renderFooters?: boolean;
        renderFootnotes?: boolean;
        renderEndnotes?: boolean;
        useBase64Images?: boolean;
    }

    export function renderAsync(
        document: Blob | ArrayBuffer | Uint8Array,
        bodyContainer: HTMLElement,
        styleContainer?: HTMLElement | null,
        options?: Options
    ): Promise<any>;
}
