/**
 * Liquid shader. Two passes over the data:
 *   vertex   - ripples the surface only, leaving the wall exactly on the
 *              profile it was built from
 *   fragment - lighter at the surface, darker at the bottom, with one cheap
 *              lambert term so the bowl reads as round
 *
 * The liquid is a lathe on the bowl's measured interior profile, so its shape
 * is already correct and the fill level is baked into the geometry. Phase 2
 * scaled the column with a uFill uniform, which only worked because the old
 * glass was a straight cylinder; on a tapered bowl the same trick moves the
 * wall sideways and pokes it through the glass.
 *
 * The profile itself lives in src/three/liquidProfile.js, because Phase 5's ice
 * and mint are bounded by the same numbers and two copies of a measured
 * profile is how the glass and the drink drift apart.
 *
 * vFrac runs 0 at the floor to 1 at the surface.
 */

export const liquidVertex = /* glsl */ `
  uniform float uTime;
  uniform float uFloorY;
  uniform float uTopY;

  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying float vFrac;

  void main() {
    vec3 transformed = position;

    float frac = clamp((transformed.y - uFloorY) / (uTopY - uFloorY), 0.0, 1.0);

    // Ripple the surface only. The frequencies are scaled up from Phase 2
    // because this bowl is roughly half the width of the old cylinder, and the
    // wave is a function of x/z, so a narrower bowl would show fewer waves.
    float topMask = smoothstep(0.82, 1.0, frac);
    float wave =
      sin(transformed.x * 20.0 + uTime * 1.6) * 0.0035 +
      sin(transformed.z * 16.0 - uTime * 1.2) * 0.0025;
    transformed.y += wave * topMask;

    vFrac = frac;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vViewPos = -mvPosition.xyz;
    vNormalV = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * mvPosition;
  }
`

export const liquidFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;

  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying float vFrac;

  void main() {
    vec3 lighter = uColor * 1.18;
    vec3 darker = uColor * 0.6;

    vec3 base = mix(darker, lighter, vFrac * vFrac);

    vec3 N = normalize(vNormalV);
    vec3 V = normalize(vViewPos);
    vec3 L = normalize(vec3(-0.5, 0.85, 0.45));

    float diffuse = 0.5 + 0.5 * max(dot(N, L), 0.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = base * (0.65 + 0.5 * diffuse) + lighter * fresnel * 0.12;

    // Phase 4 wrote a hard 1.0 here. Bubbles and ice sit inside this solid, so
    // an opaque drink hides them behind its own front face; the drink has to be
    // see-through for the build to be visible at all.
    gl_FragColor = vec4(color, uAlpha);
    #include <colorspace_fragment>
  }
`
