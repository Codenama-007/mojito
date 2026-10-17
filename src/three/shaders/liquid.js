/**
 * Liquid shader. Two passes over the data:
 *   vertex   - scales the column by uFill, then ripples only the top surface
 *   fragment - lighter at the top of the column, darker at the bottom,
 *              with one cheap lambert term so the cylinder reads as round
 *
 * vUv.y runs 0 at the bottom of the column to 1 at the top, so the vertical
 * gradient needs no magic height constant.
 */

export const liquidVertex = /* glsl */ `
  uniform float uTime;
  uniform float uFill;

  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec3 transformed = position;

    // Compress the column from its base. The interior wall is a vertical
    // cylinder, so the radius is safe at every fill level.
    transformed.y *= uFill;

    // Ripple only the top surface, fading in over the last third.
    float topMask = smoothstep(0.55, 1.0, uv.y);
    float wave =
      sin(transformed.x * 9.0 + uTime * 1.6) * 0.007 +
      sin(transformed.z * 7.0 - uTime * 1.2) * 0.005;
    transformed.y += wave * topMask;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vViewPos = -mvPosition.xyz;
    vNormalV = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * mvPosition;
  }
`

export const liquidFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFill;

  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying vec2 vUv;

  void main() {
    vec3 lighter = uColor * 1.18;
    vec3 darker = uColor * 0.6;

    vec3 base = mix(darker, lighter, vUv.y * vUv.y);

    vec3 N = normalize(vNormalV);
    vec3 V = normalize(vViewPos);
    vec3 L = normalize(vec3(-0.5, 0.85, 0.45));

    float diffuse = 0.5 + 0.5 * max(dot(N, L), 0.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = base * (0.65 + 0.5 * diffuse) + lighter * fresnel * 0.12;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`
