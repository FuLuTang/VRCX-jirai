<script setup>
    /**
     * LiquidGlassButton — a Vue port of the core visual technique from
     * https://github.com/rdev/liquid-glass-react (MIT).
     *
     * Why not import that package directly?
     *   It is a React-specific library (uses React hooks, JSX, forwardRef).
     *   Vue cannot mount React components without a bridge adapter.
     *
     * What is ported here?
     *   • SVG feGaussianBlur + feDisplacementMap filter applied on top of
     *     backdrop-filter, creating the actual lens-bending pixel distortion.
     *   • Dual border-rim layers with mix-blend-mode: screen / overlay.
     *   • Hover / press radial gradient overlay.
     *
     * Performance simplifications vs the full library:
     *   • No external JPEG displacement map (~40 KB) — edge map derived
     *     inline from SourceAlpha using two SVG filter primitives.
     *   • No chromatic aberration (skips the 3× R/G/B channel splits).
     *   • No mouse elasticity / JS animation loop.
     *   • No shader mode.
     *   • CSS transitions only on GPU-composited properties.
     */

    import { ref, useId } from 'vue';

    const props = defineProps({
        /** When true the button switches to the orange "active" tint. */
        active: { type: Boolean, default: false }
    });

    const emit = defineEmits(['click']);

    // useId() (Vue 3.5+) generates a unique, SSR-stable ID per component instance.
    const filterId = `lg-${useId()}`;

    const isHovered = ref(false);
    const isPressed = ref(false);

    function onClick(e) {
        emit('click', e);
    }
</script>

<template>
    <button
        class="lg-wrap"
        :class="{ 'lg-wrap--active': active }"
        @click="onClick"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false; isPressed = false"
        @mousedown="isPressed = true"
        @mouseup="isPressed = false"
    >
        <!--
            SVG filter definition (zero-size; the glass div references it by id).
            Placed as a sibling of the glass div, mirroring how liquid-glass-react
            places <GlassFilter> alongside the <GlassContainer>.
        -->
        <svg class="lg-defs" aria-hidden="true">
            <defs>
                <filter
                    :id="filterId"
                    x="-35%" y="-35%"
                    width="170%" height="170%"
                    color-interpolation-filters="sRGB"
                >
                    <!--
                        Derive a lens-edge displacement map from the element's own
                        alpha channel:
                          1. Blur SourceAlpha → soft shape with gradient falloff
                          2. Invert & amplify → bright-at-edges map
                          3. Use that map to displace SourceGraphic outward at edges

                        The displacement is applied to the COMPOSITED output of the
                        glass div, which already includes its backdrop-filter blur,
                        so the result is a frosted background that bends at the edges
                        — the hallmark of the liquid-glass effect.
                    -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="aBlur" />
                    <feComponentTransfer in="aBlur" result="edgeMap">
                        <feFuncR type="linear" slope="-2" intercept="1.5" />
                        <feFuncG type="linear" slope="-2" intercept="1.5" />
                        <!-- B channel: identity passthrough (not used for displacement) -->
                        <feFuncB type="linear" slope="1" intercept="0" />
                    </feComponentTransfer>
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="edgeMap"
                        scale="20"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>
        </svg>

        <!--
            The glass surface.
            backdrop-filter provides the frosted blur; the SVG filter above
            then distorts that blurred output to produce the edge refraction.
            Both properties on the same element is the same approach used by
            the original liquid-glass-react GlassContainer.
        -->
        <div
            class="lg-glass"
            :style="{ filter: `url(#${filterId})` }"
        >
            <!-- Rim highlight layer 1 — screen blend (softer outer glow) -->
            <span class="lg-rim lg-rim--screen" />
            <!-- Rim highlight layer 2 — overlay blend (sharper inner edge) -->
            <span class="lg-rim lg-rim--overlay" />

            <!-- Hover / press radial glow (ported from liquid-glass-react) -->
            <span
                class="lg-glow"
                :class="{ 'lg-glow--hover': isHovered, 'lg-glow--press': isPressed }"
            />

            <!-- Slot content (label + icon) -->
            <span class="lg-inner">
                <slot />
            </span>
        </div>
    </button>
</template>

<style scoped>
/* ── Outer wrapper ─────────────────────────────────────────────── */
.lg-wrap {
    position: relative;
    display: inline-flex;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 9999px;
    outline: none;
}

/* ── Glass surface ─────────────────────────────────────────────── */
.lg-glass {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    overflow: hidden;

    /* Frosted-glass background */
    backdrop-filter: blur(8px) saturate(130%);
    -webkit-backdrop-filter: blur(8px) saturate(130%);

    /* Default subtle blue tint */
    background: rgba(59, 130, 246, 0.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);

    /* Transition only GPU-composited properties */
    transition:
        background 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.15s ease;
}

/* Orange tint when active */
.lg-wrap--active .lg-glass {
    background: rgba(249, 115, 22, 0.20);
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.15);
}

/* Hover — lift + slightly brighter tint */
.lg-wrap:hover .lg-glass {
    background: rgba(59, 130, 246, 0.28);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
}
.lg-wrap--active:hover .lg-glass {
    background: rgba(249, 115, 22, 0.32);
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.20);
}

/* Press — scale in */
.lg-wrap:active .lg-glass {
    transform: scale(0.96);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.10);
}

/* ── Border rim (ported from liquid-glass-react) ───────────────── */
/*
   The mask-punch-through technique: set padding = rim width, then mask
   out the content-box so only the padding band (the rim) is visible.
*/
.lg-rim {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    pointer-events: none;
    padding: 1.5px;
    /* Standard + -webkit- mask for cross-browser rim rendering */
    mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
    mask-composite: exclude;
    -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    box-shadow:
        0 0 0 0.5px rgba(255, 255, 255, 0.45) inset,
        0 1px 3px rgba(255, 255, 255, 0.20) inset;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.00) 0%,
        rgba(255, 255, 255, 0.22) 35%,
        rgba(255, 255, 255, 0.55) 65%,
        rgba(255, 255, 255, 0.00) 100%
    );
}

.lg-rim--screen  { mix-blend-mode: screen;  opacity: 0.18; }
.lg-rim--overlay { mix-blend-mode: overlay; opacity: 0.7; }

/* ── Hover / press radial glow ─────────────────────────────────── */
.lg-glow {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    pointer-events: none;
    background-image: radial-gradient(
        circle at 50% 0%,
        rgba(255, 255, 255, 0.55) 0%,
        rgba(255, 255, 255, 0.00) 55%
    );
    mix-blend-mode: overlay;
    opacity: 0;
    transition: opacity 0.15s ease;
}
.lg-glow--hover { opacity: 0.30; }
.lg-glow--press { opacity: 0.60; }

/* ── Content span ──────────────────────────────────────────────── */
.lg-inner {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: rgba(255, 255, 255, 0.90);
    font-size: 0.8125rem;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.20);
    user-select: none;
}

/* ── Invisible SVG defs container ──────────────────────────────── */
.lg-defs {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
}
</style>
