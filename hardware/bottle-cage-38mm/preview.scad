view = "assembly";
$fa = 3; $fs = 1.2;
tube_d = 38; cage_x = 70;

module tube()   { color([0.78,0.10,0.10]) translate([0,0,-45]) cylinder(h=260, d=tube_d); }
module bottle() { color([0.45,0.80,0.95,0.40]) translate([cage_x,0,6.5]) union() {
                    cylinder(h=150, d=73.6);
                    translate([0,0,150]) cylinder(h=45, d1=73.6, d2=42);
                    translate([0,0,195]) cylinder(h=24, d=42); } }
module CAGE()  { color([0.17,0.42,0.72]) import("stl/bottle_cage_38mm_cage.stl"); }
module BACK()  { color([0.11,0.30,0.55]) import("stl/bottle_cage_38mm_backplate.stl"); }
module ADAPT() { color([0.17,0.42,0.72]) import("stl/bottle_cage_38mm_adapter.stl"); }

if      (view == "assembly") { tube(); bottle(); CAGE(); BACK(); }
else if (view == "parts")    { CAGE(); translate([-55,0,0]) BACK(); }
else if (view == "adapter")  { tube(); ADAPT(); }
else if (view == "section")  difference() { union(){ tube(); bottle(); CAGE(); BACK(); }
                                            translate([-200,0,-80]) cube([500,250,500]); }
