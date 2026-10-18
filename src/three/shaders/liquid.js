/**
 * Liquid shader. Two passes over the data:
 *   vertex   - ripples the surface only, leaving the wall exactly on the
 *              profile it was built from
 *   fragment - paler at the surface, a shade deeper at the foot, with one cheap
 *              lambert term so the drink reads as round
 *
 * The liquid is a lathe on the cup's interior profile, so its shape is already
 * correct and the fill level is baked into the geometry. Phase 2 scaled the
 * column with a uFill uniform, which only worked because the old glass was a
 * straight cylinder; on a tapered cup the same trick moves the wall sideways
 * and pokes it through the plastic.
 *
 * The profile itself lives in src/three/liquidProfile.js, because the ice, the
 * mint and the wall bubbles are bounded by the same numbers and two copies of a
 * profile is how the cup and the drink drift apart.
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

    // Ripple the surface only. Phase 4 tuned these frequencies against the
    // modelled bowl, which was about half this cup's width; the wave is a
    // function of x/z, so the same numbers on a wider mouth would put twice the
    // chop across it.
    float topMask = smoothstep(0.82, 1.0, frac);
    float wave =
      sin(transformed.x * 12.0 + uTime * 1.6) * 0.0035 +
      sin(transformed.z * 9.0 - uTime * 1.2) * 0.0025;
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
    // Phase 4 lit the drink's own colour. Phase 7 puts it in clear plastic
    // instead of glass, so the drink has to look like juice seen through a
    // takeaway cup: washed towards white at the top, and never so saturated
    // that the mint packed against the wall disappears into it.
    vec3 lighter = mix(uColor, vec3(1.0), 0.34);
    vec3 darker = uColor * 0.82;

    vec3 base = mix(darker, lighter, vFrac * vFrac);

    vec3 N = normalize(vNormalV);
    vec3 V = normalize(vViewPos);
    vec3 L = normalize(vec3(-0.5, 0.85, 0.45));

    float diffuse = 0.5 + 0.5 * max(dot(N, L), 0.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = base * (0.72 + 0.42 * diffuse) + lighter * fresnel * 0.18;

    // Phase 4 wrote a hard 1.0 here. Bubbles, ice and mint sit inside this
    // solid, so an opaque drink hides them behind its own front face; the drink
    // has to be see-through for the build to be visible at all.
    gl_FragColor = vec4(color, uAlpha);
    #include <colorspace_fragment>
  }
`
