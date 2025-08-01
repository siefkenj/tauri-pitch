import init, {
    AutocorrelationDetector,
    McLeodDetector,
} from "pitch-detection-wasm";
import * as Comlink from "comlink";

export class PitchWorker {
    wasmInitialized = Promise.resolve(false);
    //   wasm?: InitOutput;
    detector?: AutocorrelationDetector | McLeodDetector;

    /**
     * Initialize the WASM module. This only needs to happen once.
     */
    async init() {
        const wasmInitialized = await this.wasmInitialized;
        if (wasmInitialized) {
            // Successfully initialized, nothing to do.
            return;
        }
        let resolve: Function;
        this.wasmInitialized = new Promise((res) => {
            resolve = res;
        });
        try {
            await init();
            resolve!(true);
        } finally {
            // It is okay to resolve twice. The second call to resolve will be ignored.
            resolve!(false);
        }
    }

    async setDetector(
        name: "autocorrelation" | "mcleod",
        size: number,
        padding: number
    ) {
        await this.init();
        if (!(await this.wasmInitialized)) {
            throw new Error("WASM could not be initialized");
        }
        if (this.detector) {
            this.detector.free();
            this.detector = undefined;
        }

        switch (name) {
            case "autocorrelation":
                this.detector = AutocorrelationDetector.new(size, padding);
                break;
            case "mcleod":
                this.detector = McLeodDetector.new(size, padding);
                break;
            default:
                throw new Error(`Detector type not recognized: ${name}`);
        }
    }

    async getPitch(
        signal: Float32Array,
        sampleRate: number,
        powerThreshold: number,
        clarityThreshold: number
    ): Promise<Float32Array> {
        await this.init();
        if (!(await this.wasmInitialized)) {
            throw new Error("WASM could not be initialized");
        }
        if (!this.detector) {
            throw new Error(
                "Detector must be initialized before getting pitch"
            );
        }

        let result = new Float32Array(2);
        this.detector.get_pitch(
            signal,
            sampleRate,
            powerThreshold,
            clarityThreshold,
            result
        );

        return result;
    }
}

export default Comlink.expose(new PitchWorker());
