// =====================================================================
//  Clamp-on bicycle water-bottle cage for a 38 mm round tube
//  Designed for FDM printing in PETG, no supports, Z = tube axis.
//
//  Parts (select with -D part="..."):
//     "cage"      main body: front clamp half + cage        (print 1)
//     "backplate" rear clamp half                           (print 1)
//     "adapter"   clamp + standard 64 mm bottle-boss pad     (alternative
//                 to "cage" if you'd rather bolt on a shop cage)
//     "testring"  14 mm tall slice of both clamp halves, for a
//                 10-minute fit check before the long print
//     "all"       everything laid out for viewing
//
//  Everything is parametric. The two numbers worth checking are
//  tube_d (measure it) and bottle_d (measure your bottle).
// =====================================================================

part = "all";

$fa = 3;
$fs = 1.2;

/* ------------------------- tube + clamp ------------------------- */
tube_d       = 38.0;   // measured tube outside diameter
tube_fit     = 0.8;    // diametral clearance. A rubber shim takes up the rest.
clamp_wall   = 5.0;    // clamp shell thickness
clamp_h      = 40.0;   // height of the clamp band along the tube
part_gap     = 2.0;    // gap from parting plane to each half (4 mm total)

bolt_clear   = 5.6;    // M5 clearance hole
nut_af       = 8.4;    // M5 hex nut across flats + clearance
nut_depth    = 4.6;    // M5 nut is 4.0 thick
bolt_y       = 28.5;   // bolt centres, either side of the tube
lug_w        = 13.0;   // lug width along Y
lug_t_rear   = 7.0;    // rear (bolt-head) lug thickness
lug_t_front  = 8.0;    // front (nut) lug thickness
bolt_z       = [10, 30];   // bolt heights up the clamp band

/* --------------------------- bottle ----------------------------- */
bottle_d     = 74.0;   // standard bike bottle. Measure yours.
cage_slop    = 3.0;    // cage bore = bottle_d + this; ribs close the gap
cage_wall    = 3.2;
wing_wall    = 2.6;    // thinner at the sprung collar so it flexes
cage_h       = 122.0;

wrap_mid     = 176;    // wrap angle of the main barrel (deg)
wrap_wing    = 240;    // wrap angle at the bottom cup and the top collar
cup_z_in     = 18;     // cup height at the barrel edge
cup_z_out    = 8;      // cup height at the wing tip
collar_z_in  = 86;     // collar starts here at the barrel edge
collar_z_out = 112;    //             ... and here at the wing tip
shelf_h      = 6.0;    // floor the bottle base sits on
shelf_lip    = 6.25;   // how far the floor reaches under the bottle
wing_steps   = 32;     // stair steps used to build the sloped wings

rib_zmin     = 6;
rib_zmax     = 104;
rib_r        = 2.2;
rib_phi      = [0, 77, -77];   // deg from the back of the cage

win_phi      = 46;     // window centre, deg from the back
win_ang      = 24;     // window angular width, deg
win_zc       = 52;     // window centre height
win_h        = 54;     // window height
win_point    = 10;     // 45-deg self-supporting point top and bottom

/* ----------------------- boss adapter pad ----------------------- */
pad_t        = 12.0;   // pad thickness (blind M5 bosses 11 mm deep)
pad_w        = 24.0;
pad_h        = 88.0;
boss_spacing = 64.0;   // the bicycle standard
boss_zc      = 44.0;
boss_pilot   = 4.2;    // thread-forming / tappable for M5
boss_depth   = 11.0;

/* ======================= derived ======================= */
clamp_ir  = (tube_d + tube_fit) / 2;
clamp_or  = clamp_ir + clamp_wall;
cage_ir   = (bottle_d + cage_slop) / 2;
cage_or   = cage_ir + cage_wall;
cage_x    = clamp_or + 4 + cage_or;
rib_h     = cage_slop / 2;
lug_y0    = bolt_y - lug_w/2;
lug_y1    = bolt_y + lug_w/2;
eps       = 0.01;

function lerp(a, b, t) = a + (b - a) * t;

/* ================== 2-D clamp cross sections ================== */
// Rounded with a close (fillets the inside corners) then an open
// (breaks the outside corners) so the lug roots aren't stress risers.
module round2d(fillet = 2.0, brk = 1.2) {
    offset(r =  brk) offset(r = -brk)
    offset(r = -fillet) offset(r =  fillet)
        children();
}

module clamp_ring2d() {
    difference() {
        circle(r = clamp_or);
        circle(r = clamp_ir);
    }
}

module clamp_front2d() {
    round2d() union() {
        intersection() {
            clamp_ring2d();
            translate([part_gap, -clamp_or - 20]) square([clamp_or + 20, 2*clamp_or + 40]);
        }
        for (s = [1, -1]) scale([1, s])
            translate([part_gap, lug_y0]) square([lug_t_front, lug_w]);
    }
}

module clamp_rear2d() {
    round2d() union() {
        intersection() {
            clamp_ring2d();
            translate([-clamp_or - 20 - part_gap, -clamp_or - 20])
                square([clamp_or + 20, 2*clamp_or + 40]);
        }
        for (s = [1, -1]) scale([1, s])
            translate([-part_gap - lug_t_rear, lug_y0]) square([lug_t_rear, lug_w]);
    }
}

/* ========================= fasteners ========================= */
module bolt_holes() {
    for (z = bolt_z) for (s = [1, -1])
        translate([-20, s * bolt_y, z])
            rotate([0, 90, 0]) cylinder(h = 35, d = bolt_clear, $fn = 36);
}

// Hex pockets in the front lug, open towards the cage so the nut
// drops in from outside. Printed vertex-up, so no bridging.
module nut_pockets() {
    for (z = bolt_z) for (s = [1, -1])
        translate([part_gap + lug_t_front - nut_depth, s * bolt_y, z])
            rotate([0, 90, 0])
                cylinder(h = nut_depth + 10, r = nut_af / (2*cos(30)), $fn = 6);
}

/* =========================== cage =========================== */
// Annular wall sector, world angles a0..a1, height z0..z1.
module arc_wall(a0, a1, z0, z1, ri, t) {
    rotate([0, 0, a0])
        rotate_extrude(angle = a1 - a0)
            translate([ri, z0]) square([t, z1 - z0]);
}

module cage_shell() {
    a_mid0 = 180 - wrap_mid/2;
    a_mid1 = 180 + wrap_mid/2;
    dphi   = (wrap_wing - wrap_mid) / 2;    // extra wrap per side

    // main barrel
    arc_wall(a_mid0, a_mid1, 0, cage_h, cage_ir, cage_wall);

    // floor the bottle base sits on
    arc_wall(180 - wrap_wing/2, 180 + wrap_wing/2, 0, shelf_h,
             cage_ir - shelf_lip, shelf_lip + cage_wall);

    // bottom cup wings (top face slopes down and out: no overhang)
    // and top collar wings (underside slopes up and out at ~50 deg)
    // Each step is a wedge that starts inside the barrel and reaches a
    // little further round than the last, so every piece shares real
    // volume with its neighbours (face-only contact = non-manifold STL).
    ov = 3;
    for (i = [0 : wing_steps - 1]) {
        t1 = (i + 1) / wing_steps;
        tm = (i + 0.5) / wing_steps;
        zc = lerp(cup_z_in,    cup_z_out,    tm);
        zk = lerp(collar_z_in, collar_z_out, tm);
        for (a = [[a_mid1 - ov,        a_mid1 + dphi*t1],
                  [a_mid0 - dphi*t1,   a_mid0 + ov]]) {
            arc_wall(a[0], a[1], 0,  zc,     cage_ir, cage_wall);
            arc_wall(a[0], a[1], zk, cage_h, cage_ir, wing_wall);
        }
    }
}

// Self-supporting hex window, cut radially through the barrel.
module window_cut(phi) {
    rotate([0, 0, 180 + phi])
        translate([cage_ir - 3, 0, win_zc])
            rotate([0, 90, 0])
                linear_extrude(height = cage_wall + 8)
                    polygon([[ win_h/2, 0],
                             [ win_h/2 - win_point,  win_w()/2],
                             [-win_h/2 + win_point,  win_w()/2],
                             [-win_h/2, 0],
                             [-win_h/2 + win_point, -win_w()/2],
                             [ win_h/2 - win_point, -win_w()/2]]);
}
function win_w() = 2 * cage_ir * sin(win_ang / 2);

module cage_ribs() {
    for (phi = rib_phi)
        rotate([0, 0, 180 + phi])
            translate([cage_ir + rib_r - rib_h, 0, rib_zmin]) {
                cylinder(h = rib_zmax - rib_zmin - 8, r = rib_r, $fn = 24);
                translate([0, 0, rib_zmax - rib_zmin - 8])
                    cylinder(h = 8, r1 = rib_r, r2 = 0.6, $fn = 24);
            }
}

/* ===================== structural web ===================== */
// Boxes that get carved into shape by the tube bore and the bottle
// bore, so the clamp and the cage merge with a full-thickness fillet.
module web() {
    hull() {
        translate([15, -14, 0])  cube([60, 28, clamp_h]);
        translate([22,  -6, clamp_h]) cube([53, 12, 30]);
    }
    hull() {
        translate([22, -6, clamp_h]) cube([53, 12, 30]);
        translate([25, -4, clamp_h + 30]) cube([50, 8, 34]);
    }
}

/* ========================== parts ========================== */
module tube_bore() {
    translate([0, 0, -10]) cylinder(h = cage_h + 40, r = clamp_ir);
}
module bottle_bore() {
    // above the floor: full bottle bore
    translate([cage_x, 0, shelf_h]) cylinder(h = cage_h + 40, r = cage_ir);
    // at and below the floor: only the drain, so the shelf survives
    translate([cage_x, 0, -10]) cylinder(h = shelf_h + 10 + eps, r = cage_ir - shelf_lip);
}

module part_cage() {
    union() {
        difference() {
            union() {
                linear_extrude(height = clamp_h) clamp_front2d();
                web();
                translate([cage_x, 0, 0]) cage_shell();
            }
            tube_bore();
            bottle_bore();
            bolt_holes();
            nut_pockets();
            for (s = [1, -1]) translate([cage_x, 0, 0]) window_cut(s * win_phi);
            // keep the parting plane clean
            translate([-200, -200, -10]) cube([200 + part_gap, 400, cage_h + 40]);
        }
        translate([cage_x, 0, 0]) cage_ribs();
    }
}

module part_backplate() {
    difference() {
        linear_extrude(height = clamp_h) clamp_rear2d();
        tube_bore();
        bolt_holes();
    }
}

module part_adapter() {
    difference() {
        union() {
            linear_extrude(height = clamp_h) clamp_front2d();
            translate([clamp_ir - 2, -pad_w/2, 0])
                cube([clamp_or + pad_t - clamp_ir + 2, pad_w, pad_h]);
        }
        tube_bore();
        bolt_holes();
        nut_pockets();
        for (s = [1, -1])
            translate([clamp_or + pad_t + 0.5, 0, boss_zc + s * boss_spacing/2])
                rotate([0, -90, 0]) cylinder(h = boss_depth + 0.5, d = boss_pilot, $fn = 32);
        translate([-200, -200, -10]) cube([200 + part_gap, 400, cage_h + 40]);
    }
}

module part_testring() {
    h = 14;
    intersection() {
        union() {
            difference() {
                linear_extrude(height = clamp_h) clamp_front2d();
                tube_bore(); bolt_holes(); nut_pockets();
            }
            translate([0, 0, 0]) difference() {
                linear_extrude(height = clamp_h) clamp_rear2d();
                tube_bore(); bolt_holes();
            }
        }
        translate([-100, -100, bolt_z[0] - h/2]) cube([200, 200, h]);
    }
}

module part_testring_flat() {
    translate([0, 0, -(bolt_z[0] - 7)]) part_testring();
}

/* ========================= render ========================= */
if      (part == "cage")      part_cage();
else if (part == "backplate") part_backplate();
else if (part == "adapter")   part_adapter();
else if (part == "testring")  part_testring_flat();
else {
    part_cage();
    part_backplate();
    translate([0, 130, 0]) part_adapter();
}
