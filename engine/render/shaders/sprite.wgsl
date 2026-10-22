struct camera {
    view_projection: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> u_camera: camera;
@group(0) @binding(1) var s_sprite: sampler;
@group(1) @binding(0) var t_sprite: texture_2d<f32>;

struct instance {
    @location(0) uv_rect: vec4f,
    @location(1) color: vec4f,
    @location(2) position: vec2f,
    @location(3) size: vec2f,
    @location(4) rotation: f32,
};

struct varyings {
    @builtin(position) clip_position: vec4f,
    @location(0) uv: vec2f,
    @location(1) color: vec4f,
};

// Two triangles covering a unit quad centered on the origin.
var<private> corners: array<vec2f, 6> = array<vec2f, 6>(
    vec2f(-0.5, -0.5), vec2f(0.5, -0.5), vec2f(0.5, 0.5),
    vec2f(-0.5, -0.5), vec2f(0.5, 0.5), vec2f(-0.5, 0.5),
);

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32, sprite: instance) -> varyings {
    let corner = corners[vertex_index];
    let local = corner * sprite.size;
    let c = cos(sprite.rotation);
    let s = sin(sprite.rotation);
    let world = sprite.position + vec2f(local.x * c - local.y * s, local.x * s + local.y * c);

    // World y points up but image rows run top-down, so the top edge of the quad samples the minimum v.
    let t = corner + 0.5;

    var out: varyings;
    out.clip_position = u_camera.view_projection * vec4f(world, 0.0, 1.0);
    out.uv = vec2f(mix(sprite.uv_rect.x, sprite.uv_rect.z, t.x), mix(sprite.uv_rect.w, sprite.uv_rect.y, t.y));
    out.color = sprite.color;
    return out;
}

@fragment
fn fs_main(in: varyings) -> @location(0) vec4f {
    return textureSample(t_sprite, s_sprite, in.uv) * in.color;
}
