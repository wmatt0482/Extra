#!/usr/bin/env python3
"""Validate the bundled ZeroIn catalog JSON (stdlib only).

Mirrors Catalog.validate() in CatalogTypes.swift and adds range/coverage checks.
Usage: python3 tools/validate_catalog.py [catalog_dir]
"""
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DIR = os.path.join(HERE, "..", "ZeroIn", "Resources", "Catalog")
CATEGORIES = {"boltAction", "semiAuto", "leverAction", "singleShot", "rimfire",
              "muzzleloader", "shotgun", "handgun"}


def load(directory, name):
    with open(os.path.join(directory, name), encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit(f"{name}: top level must be an array")
    return data


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR
    calibers = load(directory, "calibers.json")
    firearms = load(directory, "firearms.json")
    ammo = load(directory, "ammo.json")
    targets = load(directory, "targets.json")
    errors = []

    def dup_check(kind, items):
        for i, n in Counter(x.get("id") for x in items).items():
            if n > 1:
                errors.append(f"duplicate {kind} id: {i}")

    def need(kind, item, keys):
        for k, t in keys.items():
            v = item.get(k)
            if v is None or not t(v):
                errors.append(f"{kind} {item.get('id')}: missing/invalid '{k}'")

    isstr = lambda v: isinstance(v, str) and v != ""
    for c in calibers:
        need("caliber", c, {"id": isstr, "name": isstr, "bulletDiameterInches": is_num})
        if is_num(c.get("bulletDiameterInches")) and not 0.15 <= c["bulletDiameterInches"] <= 0.8:
            errors.append(f"caliber {c['id']}: diameter out of range")
    for f in firearms:
        need("firearm", f, {"id": isstr, "make": isstr, "model": isstr, "category": isstr,
                            "caliberID": isstr, "typicalSightHeightInches": is_num})
        if f.get("category") not in CATEGORIES:
            errors.append(f"firearm {f['id']}: invalid category {f.get('category')}")
        sh = f.get("typicalSightHeightInches")
        if is_num(sh) and not 0.3 <= sh <= 3.5:
            errors.append(f"firearm {f['id']}: sight height {sh} out of range")
        for k, lo, hi in (("barrelLengthInches", 3, 40), ("twistInches", 5, 40)):
            if k in f and not (is_num(f[k]) and lo <= f[k] <= hi):
                errors.append(f"firearm {f['id']}: {k} out of range")
    for a in ammo:
        need("ammo", a, {"id": isstr, "make": isstr, "line": isstr, "caliberID": isstr,
                         "bulletWeightGrains": is_num, "muzzleVelocityFPS": is_num})
    for t in targets:
        need("target", t, {"id": isstr, "name": isstr, "widthInches": is_num, "heightInches": is_num})

    dup_check("caliber", calibers)
    dup_check("firearm", firearms)
    dup_check("ammo", ammo)
    dup_check("target", targets)

    cal_ids = {c["id"] for c in calibers}
    for f in firearms:
        if f.get("caliberID") not in cal_ids:
            errors.append(f"firearm {f['id']} references unknown caliber {f.get('caliberID')}")
    for a in ammo:
        i = a.get("id")
        if a.get("caliberID") not in cal_ids:
            errors.append(f"ammo {i} references unknown caliber {a.get('caliberID')}")
        g1, g7 = a.get("g1BC"), a.get("g7BC")
        if g1 is None and g7 is None:
            errors.append(f"ammo {i} has no BC")
        if g1 is not None and not (is_num(g1) and 0.08 <= g1 <= 0.9):
            errors.append(f"ammo {i}: G1 BC {g1} outside 0.08-0.9")
        if g7 is not None and not (is_num(g7) and 0.08 <= g7 <= 0.45):
            errors.append(f"ammo {i}: G7 BC {g7} outside 0.08-0.45")
        mv = a.get("muzzleVelocityFPS")
        if is_num(mv) and not 600 <= mv <= 4500:
            errors.append(f"ammo {i}: MV {mv} outside 600-4500")
        w = a.get("bulletWeightGrains")
        if is_num(w) and not 15 <= w <= 600:
            errors.append(f"ammo {i}: weight {w} outside 15-600 gr")

    fa_count = Counter(f.get("caliberID") for f in firearms)
    am_count = Counter(a.get("caliberID") for a in ammo)
    for c in calibers:
        if fa_count[c["id"]] < 1:
            errors.append(f"caliber {c['id']} has no firearm")
        if am_count[c["id"]] < 2:
            errors.append(f"caliber {c['id']} has {am_count[c['id']]} ammo loads (need >= 2)")

    print(f"calibers: {len(calibers)}  firearms: {len(firearms)}  ammo: {len(ammo)}  targets: {len(targets)}")
    print("firearms by category:", dict(sorted(Counter(f.get('category') for f in firearms).items())))
    if errors:
        print(f"\n{len(errors)} problem(s):")
        for e in errors:
            print("  -", e)
        return 1
    print("OK: catalog is valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
