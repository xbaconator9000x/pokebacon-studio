/* mGBA → WebAssembly shim.
 *
 * mGBA already has the frontend-facing abstraction the sibling ports had to
 * invent: `struct mCore` is a vtable over "load a ROM, run one frame, hand me
 * pixels and samples", and it is the same struct for the GBA and Game Boy
 * cores. So this file is not a reimplementation of a frontend — it is a flat C
 * ABI over mCore, plus the two things a browser needs that mCore does not
 * provide: a tightly-packed RGBA framebuffer and an interleaved int16 pull for
 * an AudioWorklet.
 *
 * Everything here is single-instance on purpose: one page, one emulator.
 */

#include <mgba/core/core.h>
#include <mgba/core/config.h>
#include <mgba/core/log.h>
#include <mgba-util/audio-buffer.h>
#include <mgba-util/image.h>
#include <mgba-util/vfs.h>

#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten.h>

#define EXPORT EMSCRIPTEN_KEEPALIVE

/* Super Game Boy draws a border around the 160x144 picture, which is the
 * largest output any of these cores produces. The video buffer is allocated
 * once at this size and handed to the core with a constant stride, exactly as
 * the libretro port does, so a mid-game resolution change never reallocates. */
#define VIDEO_WIDTH_MAX 256
#define VIDEO_HEIGHT_MAX 224

/* Log levels as the SDK's `options.logLevel` numbers them. */
enum {
	LOG_OFF = 0,
	LOG_ERROR = 1,
	LOG_DEBUG = 2,
};

static struct mCore* core = NULL;

/* The core's own framebuffer: mColor, which without COLOR_16_BIT is a uint32
 * laid out by M_RGB5_TO_BGR8 — bytes R, G, B, 0 in memory. One OR per pixel
 * away from what a canvas ImageData wants. */
static mColor* videoBuffer = NULL;
/* Tightly packed RGBA the SDK reads straight into ImageData. */
static uint32_t* rgbaBuffer = NULL;

static unsigned videoWidth = 0;
static unsigned videoHeight = 0;

/* ROM and BIOS bytes must outlive the VFile wrapped around them: mGBA keeps
 * the mapping for the life of the cartridge rather than copying it. */
static void* romData = NULL;
static size_t romSize = 0;
static void* biosData = NULL;
static size_t biosSize = 0;

static void* sramData = NULL;
static size_t sramSize = 0;

static int logLevel = LOG_ERROR;

/* --------------------------------------------------------------- logging */

static void _log(struct mLogger* logger, int category, enum mLogLevel level, const char* format,
                 va_list args) {
	UNUSED(logger);

	if (logLevel == LOG_OFF) {
		return;
	}
	if (logLevel == LOG_ERROR && !(level & (mLOG_FATAL | mLOG_ERROR | mLOG_WARN))) {
		return;
	}

	char buffer[512];
	vsnprintf(buffer, sizeof(buffer), format, args);
	printf("[mgba:%s] %s\n", mLogCategoryName(category), buffer);
}

static struct mLogger shimLogger = { .log = _log, .filter = NULL };

EXPORT void mgbawasm_set_log_level(int level) {
	logLevel = level;
}

/* ----------------------------------------------------------------- setup */

/** Installs the shim's logger. Safe to call more than once. */
EXPORT void mgbawasm_init(void) {
	mLogSetDefaultLogger(&shimLogger);
}

static void _freeCore(void) {
	if (core) {
		core->unloadROM(core);
		mCoreConfigDeinit(&core->config);
		core->deinit(core);
		core = NULL;
	}
	free(videoBuffer);
	videoBuffer = NULL;
	free(rgbaBuffer);
	rgbaBuffer = NULL;
	free(romData);
	romData = NULL;
	romSize = 0;
	free(biosData);
	biosData = NULL;
	biosSize = 0;
	free(sramData);
	sramData = NULL;
	sramSize = 0;
	videoWidth = 0;
	videoHeight = 0;
}

EXPORT void mgbawasm_unload(void) {
	_freeCore();
}

/**
 * Boots a cartridge.
 *
 * `platform` is an `enum mPlatform`, or -1 to let mGBA sniff the image —
 * which is what `options.system: 'auto'` sends and what every well-formed dump
 * wants. `bios` may be NULL; mGBA's high-level BIOS covers virtually every
 * commercial title, so it is genuinely optional rather than politely optional.
 *
 * There is deliberately no sample-rate argument. Unlike most emulator cores,
 * these two do not resample: the Game Boy core emits a fixed 131072 Hz, and the
 * GBA core emits whatever its SOUNDBIAS register says — 32768 Hz out of reset,
 * 65536 Hz once a game raises the resolution, and it can change while the game
 * runs. mGBA's own `sampleRate` option is read by its desktop frontends, which
 * resample themselves. So does this one, in the AudioWorklet; ask
 * `mgbawasm_sample_rate()` for the rate that is current right now.
 *
 * `gbModel` is one of mGBA's `gb.model` names ("DMG", "SGB", "CGB", "AGB"), or
 * NULL to detect it from the cartridge header; it is ignored by the GBA core.
 * It and `skipBios` are arguments rather than setters because the core reads
 * both while it maps the cartridge — there is no point at which changing them
 * afterwards would mean anything.
 *
 * Returns 1 on success.
 */
EXPORT int mgbawasm_load(const void* rom, int romBytes, const void* bios, int biosBytes,
                         int platform, const char* gbModel, int skipBios) {
	_freeCore();

	if (!rom || romBytes <= 0) {
		return 0;
	}

	/* The VFile must own memory that outlives this call. */
	romData = malloc((size_t) romBytes);
	if (!romData) {
		return 0;
	}
	memcpy(romData, rom, (size_t) romBytes);
	romSize = (size_t) romBytes;

	struct VFile* romVf = VFileFromMemory(romData, romSize);
	if (!romVf) {
		_freeCore();
		return 0;
	}

	if (platform < 0) {
		core = mCoreFindVF(romVf);
	} else {
		core = mCoreCreate((enum mPlatform) platform);
	}
	if (!core) {
		romVf->close(romVf);
		_freeCore();
		return 0;
	}

	mCoreInitConfig(core, NULL);
	if (!core->init(core)) {
		romVf->close(romVf);
		_freeCore();
		return 0;
	}

	/* mCoreInitConfig only creates the tables — it seeds no values, so every
	 * mCoreOptions field starts at zero and a frontend that skips this step
	 * gets `volume = 0`, i.e. a perfectly working emulator that is silent.
	 * These are the same defaults mGBA's own libretro port installs. */
	struct mCoreOptions defaults = {
		.useBios = true,
		.skipBios = skipBios != 0,
		.volume = 0x100,
		.logLevel = mLOG_ALL,
	};
	mCoreConfigLoadDefaults(&core->config, &defaults);

	if (gbModel && gbModel[0]) {
		mCoreConfigSetValue(&core->config, "gb.model", gbModel);
	}

	mCoreLoadConfig(core);

	videoBuffer = calloc(VIDEO_WIDTH_MAX * VIDEO_HEIGHT_MAX, sizeof(mColor));
	rgbaBuffer = calloc(VIDEO_WIDTH_MAX * VIDEO_HEIGHT_MAX, sizeof(uint32_t));
	if (!videoBuffer || !rgbaBuffer) {
		romVf->close(romVf);
		_freeCore();
		return 0;
	}
	core->setVideoBuffer(core, videoBuffer, VIDEO_WIDTH_MAX);

	/* Sized for the worst case rather than for the rate at reset, because the
	 * GBA rate can double mid-game and the SDK only drains once per frame:
	 * 131072 Hz (the Game Boy core) over one frame is ~2200 stereo pairs. The
	 * cap is mGBA's own — its blip buffer does not go past 0x4000. */
	core->setAudioBufferSize(core, 0x4000);

	/* loadROM takes ownership of the VFile on success. */
	if (!core->loadROM(core, romVf)) {
		romVf->close(romVf);
		_freeCore();
		return 0;
	}

	if (bios && biosBytes > 0) {
		biosData = malloc((size_t) biosBytes);
		if (biosData) {
			memcpy(biosData, bios, (size_t) biosBytes);
			biosSize = (size_t) biosBytes;
			struct VFile* biosVf = VFileFromMemory(biosData, biosSize);
			if (biosVf && !core->loadBIOS(core, biosVf, 0)) {
				biosVf->close(biosVf);
			}
		}
	}

	core->reset(core);
	core->currentVideoSize(core, &videoWidth, &videoHeight);
	return 1;
}

/** `enum mPlatform` of the core that actually got created, or -1. */
EXPORT int mgbawasm_platform(void) {
	return core ? (int) core->platform(core) : -1;
}

EXPORT void mgbawasm_reset(void) {
	if (core) {
		core->reset(core);
		core->currentVideoSize(core, &videoWidth, &videoHeight);
	}
}

/* ------------------------------------------------------------------ video */

/**
 * Runs exactly one frame and packs the result.
 *
 * The core writes into `videoBuffer` at a constant `VIDEO_WIDTH_MAX` stride
 * while the visible picture can be anything from 160x144 (Game Boy) to 256x224
 * (Super Game Boy border) to 240x160 (GBA), so this repacks to a tight
 * `width * height` RGBA block and sets the alpha the core leaves at zero.
 */
EXPORT void mgbawasm_run_frame(void) {
	if (!core) {
		return;
	}

	core->runFrame(core);
	core->currentVideoSize(core, &videoWidth, &videoHeight);

	unsigned width = videoWidth > VIDEO_WIDTH_MAX ? VIDEO_WIDTH_MAX : videoWidth;
	unsigned height = videoHeight > VIDEO_HEIGHT_MAX ? VIDEO_HEIGHT_MAX : videoHeight;

	for (unsigned y = 0; y < height; ++y) {
		const mColor* src = &videoBuffer[y * VIDEO_WIDTH_MAX];
		uint32_t* dst = &rgbaBuffer[y * width];
		for (unsigned x = 0; x < width; ++x) {
			dst[x] = (uint32_t) src[x] | 0xFF000000u;
		}
	}
}

EXPORT void* mgbawasm_video_ptr(void) {
	return rgbaBuffer;
}

EXPORT int mgbawasm_video_width(void) {
	return (int) videoWidth;
}

EXPORT int mgbawasm_video_height(void) {
	return (int) videoHeight;
}

EXPORT int mgbawasm_frame_counter(void) {
	return core ? (int) core->frameCounter(core) : 0;
}

/**
 * Frames per second in micro-Hz, so the exact rate survives the trip through
 * an int: 59.7275 Hz on GBA, 59.7275 on GB too, but the cores derive it from
 * their own clock rather than from a constant.
 */
EXPORT int mgbawasm_framerate_micro(void) {
	if (!core) {
		return 0;
	}
	int32_t cycles = core->frameCycles(core);
	if (cycles <= 0) {
		return 0;
	}
	return (int) ((double) core->frequency(core) / (double) cycles * 1e6);
}

/* ------------------------------------------------------------------ audio */

EXPORT int mgbawasm_sample_rate(void) {
	return core ? (int) core->audioSampleRate(core) : 0;
}

/** Frames (stereo pairs) waiting in the core's buffer. */
EXPORT int mgbawasm_audio_available(void) {
	if (!core) {
		return 0;
	}
	return (int) mAudioBufferAvailable(core->getAudioBuffer(core));
}

/**
 * Drains up to `frames` interleaved stereo pairs into `out`, returning how many
 * were actually read. Short reads are normal — the number of samples a frame
 * produces wobbles around the nominal rate.
 */
EXPORT int mgbawasm_read_audio(int16_t* out, int frames) {
	if (!core || !out || frames <= 0) {
		return 0;
	}
	return (int) mAudioBufferRead(core->getAudioBuffer(core), out, (size_t) frames);
}

/* ------------------------------------------------------------------ input */

/**
 * Sets the whole key state at once, as a bitmask of `enum GBAKey`. The Game Boy
 * core numbers its first eight keys identically (A, B, Select, Start, Right,
 * Left, Up, Down), so one mask drives both; the L/R bits are simply ignored
 * when a Game Boy ROM is running.
 */
EXPORT void mgbawasm_set_keys(unsigned keys) {
	if (core) {
		core->setKeys(core, keys);
	}
}

/* ------------------------------------------------------------- savestates */

EXPORT int mgbawasm_state_size(void) {
	return core ? (int) core->stateSize(core) : 0;
}

EXPORT int mgbawasm_state_save(void* out) {
	if (!core || !out) {
		return 0;
	}
	return core->saveState(core, out) ? 1 : 0;
}

EXPORT int mgbawasm_state_load(const void* in) {
	if (!core || !in) {
		return 0;
	}
	return core->loadState(core, in) ? 1 : 0;
}

/* ------------------------------------------------------------------- SRAM */

/**
 * Snapshots battery-backed save memory into a shim-owned buffer.
 *
 * `savedataClone` mallocs, so the pointer is parked in `sramData` and freed on
 * the next call — the SDK is expected to copy the bytes out before doing
 * anything else. Returns the byte count, or 0 when the cartridge has no
 * savedata (which is not an error: plenty of carts have none).
 */
EXPORT int mgbawasm_sram_save(void) {
	if (!core) {
		return 0;
	}
	free(sramData);
	sramData = NULL;
	sramSize = core->savedataClone(core, &sramData);
	return (int) sramSize;
}

EXPORT void* mgbawasm_sram_ptr(void) {
	return sramData;
}

EXPORT int mgbawasm_sram_load(const void* data, int bytes) {
	if (!core || !data || bytes <= 0) {
		return 0;
	}
	return core->savedataRestore(core, data, (size_t) bytes, true) ? 1 : 0;
}

/* ---------------------------------------------------------------- options */

/*
 * Everything below writes into the core's own `mCoreConfig` and then asks the
 * core to re-read that one key. mGBA is built for this — it is how its Qt
 * frontend applies a settings change to a running game — so these take effect
 * without a reset.
 */

static void _reload(const char* key) {
	if (core && core->reloadConfigOption) {
		core->reloadConfigOption(core, key, &core->config);
	}
}

/** 0 = ignore, 1 = remove, 2 = detect. */
EXPORT void mgbawasm_set_idle_optimization(int mode) {
	if (!core) {
		return;
	}
	const char* value = mode == 0 ? "ignore" : (mode == 2 ? "detect" : "remove");
	mCoreConfigSetValue(&core->config, "idleOptimization", value);
	_reload("idleOptimization");
}

EXPORT void mgbawasm_set_allow_opposing_directions(int allow) {
	if (!core) {
		return;
	}
	mCoreConfigSetIntValue(&core->config, "allowOpposingDirections", allow ? 1 : 0);
	_reload("allowOpposingDirections");
}

/** Whether a BIOS image was supplied and accepted for this session. */
EXPORT int mgbawasm_has_bios(void) {
	return biosData ? 1 : 0;
}

