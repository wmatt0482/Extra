view = "assembly";
$fa = 3; $fs = 1.2;
tube_d = 38; cage_x = 79.85;

// Owala FreeSip 40 oz: 91.4 mm dia, 296 mm tall
module tube()   { color([0.78,0.10,0.10]) translate([0,0,-50]) cylinder(h=330, d=tube_d); }
module bottle() { color([0.45,0.80,0.95,0.40]) translate([cage_x,0,12.5]) union() {
                    cylinder(h=232, d=91.4);
                    translate([0,0,232]) cylinder(h=22, d1=91.4, d2=74);
                    translate([0,0,254]) cylinder(h=42, d=74); } }
module strap()  { color([0.15,0.15,0.17])
                    for (z=[48,92]) translate([cage_x,0,z]) rotate_extrude(angle=200)
                      translate([46.5,-13.5]) square([3,27]); }
module CAGE()  { color([0.17,0.42,0.72]) import("stl/bottle_cage_38mm_cage.stl"); }
module BACK()  { color([0.11,0.30,0.55]) import("stl/bottle_cage_38mm_backplate.stl"); }
module ADAPT() { color([0.17,0.42,0.72]) import("stl/bottle_cage_38mm_adapter.stl"); }

if      (view == "assembly") { tube(); bottle(); CAGE(); BACK(); }
else if (view == "strapped") { tube(); bottle(); CAGE(); BACK();
                               rotate([0,0,0]) translate([0,0,0]) strap(); }
else if (view == "parts")    { CAGE(); translate([-60,0,0]) BACK(); }
else if (view == "floor")    difference() { CAGE(); translate([-200,-200,26]) cube([500,500,500]);
                                            translate([-200,0,-80]) cube([500,250,500]); }
else if (view == "section")  difference() { union(){ tube(); bottle(); CAGE(); BACK(); }
                                            translate([-200,0,-80]) cube([500,250,500]); }
