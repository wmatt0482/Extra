#!/usr/bin/env python3
"""ZeroIn ballistic reference: a line-by-line Python port of the Swift solver in
ZeroInCore/Sources/ZeroInCore/Ballistics/ (DragTables.swift, Atmosphere+Physics.swift,
BallisticSolver.swift), plus a comparison harness against py-ballisticcalc.

There is no Swift toolchain in the environment where the solver was written, so this
port IS the numerical verification: same tables, constants, integrator, zero solve and
MPBR search, in the same order. If you change the Swift, change this file the same way
and re-run it.

Usage:
    python3 tools/ballistics_reference.py                  # compare vs py-ballisticcalc, exit 1 on failure
    python3 tools/ballistics_reference.py --update-swift   # ...and rewrite the generated vector block
                                                           #    in ZeroInCore/Tests/ZeroInCoreTests/BallisticsTests.swift
    python3 tools/ballistics_reference.py --port-only      # just print the port's own tables (no pbc needed)

See tools/README.md for setup (venv + `pip install py-ballisticcalc`).
"""

from __future__ import annotations

import math
import os
import sys

# =============================================================================
# DragTables.swift
# =============================================================================

# Standard G1 drag function (Ingalls / BRL), Cd vs Mach. Same 79 rows as JBM / GNU Ballistics.
G1_TABLE = [
    (0.0, 0.2629), (0.05, 0.2558), (0.1, 0.2487), (0.15, 0.2413), (0.2, 0.2344), (0.25, 0.2278),
    (0.3, 0.2214), (0.35, 0.2155), (0.4, 0.2104), (0.45, 0.2061), (0.5, 0.2032), (0.55, 0.202),
    (0.6, 0.2034), (0.7, 0.2165), (0.725, 0.223), (0.75, 0.2313), (0.775, 0.2417), (0.8, 0.2546),
    (0.825, 0.2706), (0.85, 0.2901), (0.875, 0.3136), (0.9, 0.3415), (0.925, 0.3734), (0.95, 0.4084),
    (0.975, 0.4448), (1.0, 0.4805), (1.025, 0.5136), (1.05, 0.5427), (1.075, 0.5677), (1.1, 0.5883),
    (1.125, 0.6053), (1.15, 0.6191), (1.2, 0.6393), (1.25, 0.6518), (1.3, 0.6589), (1.35, 0.6621),
    (1.4, 0.6625), (1.45, 0.6607), (1.5, 0.6573), (1.55, 0.6528), (1.6, 0.6474), (1.65, 0.6413),
    (1.7, 0.6347), (1.75, 0.628), (1.8, 0.621), (1.85, 0.6141), (1.9, 0.6072), (1.95, 0.6003),
    (2.0, 0.5934), (2.05, 0.5867), (2.1, 0.5804), (2.15, 0.5743), (2.2, 0.5685), (2.25, 0.563),
    (2.3, 0.5577), (2.35, 0.5527), (2.4, 0.5481), (2.45, 0.5438), (2.5, 0.5397), (2.6, 0.5325),
    (2.7, 0.5264), (2.8, 0.5211), (2.9, 0.5168), (3.0, 0.5133), (3.1, 0.5105), (3.2, 0.5084),
    (3.3, 0.5067), (3.4, 0.5054), (3.5, 0.504), (3.6, 0.503), (3.7, 0.5022), (3.8, 0.5016),
    (3.9, 0.501), (4.0, 0.5006), (4.2, 0.4998), (4.4, 0.4995), (4.6, 0.4992), (4.8, 0.499),
    (5.0, 0.4988),
]

# Standard G7 drag function (long boat-tail), Cd vs Mach. Same 84 rows as JBM / GNU Ballistics.
G7_TABLE = [
    (0.0, 0.1198), (0.05, 0.1197), (0.1, 0.1196), (0.15, 0.1194), (0.2, 0.1193), (0.25, 0.1194),
    (0.3, 0.1194), (0.35, 0.1194), (0.4, 0.1193), (0.45, 0.1193), (0.5, 0.1194), (0.55, 0.1193),
    (0.6, 0.1194), (0.65, 0.1197), (0.7, 0.1202), (0.725, 0.1207), (0.75, 0.1215), (0.775, 0.1226),
    (0.8, 0.1242), (0.825, 0.1266), (0.85, 0.1306), (0.875, 0.1368), (0.9, 0.1464), (0.925, 0.166),
    (0.95, 0.2054), (0.975, 0.2993), (1.0, 0.3803), (1.025, 0.4015), (1.05, 0.4043), (1.075, 0.4034),
    (1.1, 0.4014), (1.125, 0.3987), (1.15, 0.3955), (1.2, 0.3884), (1.25, 0.381), (1.3, 0.3732),
    (1.35, 0.3657), (1.4, 0.358), (1.5, 0.344), (1.55, 0.3376), (1.6, 0.3315), (1.65, 0.326),
    (1.7, 0.3209), (1.75, 0.316), (1.8, 0.3117), (1.85, 0.3078), (1.9, 0.3042), (1.95, 0.301),
    (2.0, 0.298), (2.05, 0.2951), (2.1, 0.2922), (2.15, 0.2892), (2.2, 0.2864), (2.25, 0.2835),
    (2.3, 0.2807), (2.35, 0.2779), (2.4, 0.2752), (2.45, 0.2725), (2.5, 0.2697), (2.55, 0.267),
    (2.6, 0.2643), (2.65, 0.2615), (2.7, 0.2588), (2.75, 0.2561), (2.8, 0.2533), (2.85, 0.2506),
    (2.9, 0.2479), (2.95, 0.2451), (3.0, 0.2424), (3.1, 0.2368), (3.2, 0.2313), (3.3, 0.2258),
    (3.4, 0.2205), (3.5, 0.2154), (3.6, 0.2106), (3.7, 0.206), (3.8, 0.2017), (3.9, 0.1975),
    (4.0, 0.1935), (4.2, 0.1861), (4.4, 0.1793), (4.6, 0.173), (4.8, 0.1672), (5.0, 0.1618),
]

G1_MACH = [m for m, _ in G1_TABLE]
G1_CD = [c for _, c in G1_TABLE]
G7_MACH = [m for m, _ in G7_TABLE]
G7_CD = [c for _, c in G7_TABLE]


def drag_coefficient(model: str, mach: float) -> float:
    """DragTables.dragCoefficient(_:mach:) — linear interpolation, clamped at both ends."""
    if model == "g1":
        machs, cds = G1_MACH, G1_CD
    else:
        machs, cds = G7_MACH, G7_CD
    return interpolate(machs, cds, mach)


def interpolate(machs, cds, mach):
    """DragTables.interpolate — binary search for the bracketing rows."""
    n = len(machs)
    if not (mach > machs[0]):  # also catches NaN
        return cds[0]
    if mach >= machs[n - 1]:
        return cds[n - 1]
    lo = 0
    hi = n - 1
    # Invariant: machs[lo] <= mach < machs[hi]
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if machs[mid] <= mach:
            lo = mid
        else:
            hi = mid
    t = (mach - machs[lo]) / (machs[hi] - machs[lo])
    return cds[lo] + t * (cds[hi] - cds[lo])


# =============================================================================
# Atmosphere+Physics.swift
# =============================================================================

STANDARD_PRESSURE_INHG = 29.92
STANDARD_TEMPERATURE_R = 518.67  # 59 °F
RANKINE_OFFSET = 459.67
SPEED_OF_SOUND_COEFF = 49.0223  # fps per sqrt(°R)
VAPOR_DENSITY_FACTOR = 0.3780  # 1 - Mv/Md  (Mv = 18.015, Md = 28.965)
HPA_TO_INHG = 0.029_529_98


def saturation_vapor_pressure_inhg(temperature_f: float) -> float:
    """Arden Buck (1996) saturation vapour pressure over water, returned in inHg."""
    tc = (temperature_f - 32.0) * 5.0 / 9.0
    hpa = 6.1121 * math.exp((18.678 - tc / 234.5) * (tc / (257.14 + tc)))
    return hpa * HPA_TO_INHG


def density_ratio(temperature_f, pressure_inhg, humidity_percent):
    """Atmosphere.densityRatio — ideal-gas density of moist air vs ICAO sea level (59 °F, 29.92 inHg, dry)."""
    t_r = max(temperature_f + RANKINE_OFFSET, 1.0)
    rh = min(max(humidity_percent, 0.0), 100.0) / 100.0
    p_v = rh * saturation_vapor_pressure_inhg(temperature_f)
    # Moist air: rho = (Pd*Md + Pv*Mv)/(R*T) = (P - 0.378*Pv)*Md/(R*T)
    effective_p = max(pressure_inhg - VAPOR_DENSITY_FACTOR * p_v, 0.0)
    return (effective_p / STANDARD_PRESSURE_INHG) * (STANDARD_TEMPERATURE_R / t_r)


def speed_of_sound_fps(temperature_f):
    """Atmosphere.speedOfSoundFPS — 49.0223 * sqrt(T in °R). Humidity is ignored (< 0.3 % effect)."""
    t_r = max(temperature_f + RANKINE_OFFSET, 1.0)
    return SPEED_OF_SOUND_COEFF * math.sqrt(t_r)


# =============================================================================
# BallisticSolver.swift
# =============================================================================

GRAVITY_FPS2 = 32.174
# Standard retardation constant for BCs in lb/in²:
#   a = rho * v² * Cd * A / (2 m),   A = pi d²/4 [in²] / 144 [in²/ft²],   BC = m / d² (lb/in²)
#   => a = (rho0 * pi / (8 * 144)) * densityRatio * Cd * v² / BC,   rho0 = 0.0764742 lb/ft³
STANDARD_AIR_DENSITY_LB_FT3 = 0.0764742
DRAG_CONSTANT = STANDARD_AIR_DENSITY_LB_FT3 * math.pi / (8.0 * 144.0)  # = 2.08551e-4 ft⁻¹·(lb/in²)
TIME_STEP = 0.0005  # s
MINIMUM_VELOCITY_FPS = 100.0
MINIMUM_PATH_INCHES = -5000.0
MAX_STEPS = 400_000  # 200 s of flight: a hard stop that is never reached in practice
MAX_ROWS = 100_000  # guards against absurd step sizes
MPH_TO_FPS = 5280.0 / 3600.0
NOT_REACHED_PATH_INCHES = -1.0e6  # zero solve sentinel for "bullet never got there"


class Sample:
    """BallisticSolver.Sample — one integrator step (feet, seconds, fps)."""
    __slots__ = ("t", "x", "y", "z", "v")

    def __init__(self, t, x, y, z, v):
        self.t = t
        self.x = x
        self.y = y
        self.z = z
        self.v = v


class Projectile:
    def __init__(self, bc, drag_model, weight_grains, diameter_inches, muzzle_velocity_fps):
        self.bc = bc
        self.drag_model = drag_model
        self.weight_grains = weight_grains
        self.diameter_inches = diameter_inches
        self.muzzle_velocity_fps = muzzle_velocity_fps


class Conditions:
    def __init__(self, altitude_ft=0.0, temperature_f=59.0, pressure_inhg=29.92, humidity=0.0,
                 wind_mph=0.0, wind_deg=90.0, inclination_deg=0.0):
        self.altitude_ft = altitude_ft
        self.temperature_f = temperature_f
        self.pressure_inhg = pressure_inhg
        self.humidity = humidity
        self.wind_mph = wind_mph
        self.wind_deg = wind_deg
        self.inclination_deg = inclination_deg


def energy_ft_lb(grains, fps):
    """Conversions.energyFtLb"""
    return grains * fps * fps / 450_437.0


class TrajectoryPoint:
    def __init__(self, range_yards, path_inches, windage_inches, velocity_fps, energy, time_s, mach, drop_from_bore):
        self.range_yards = range_yards
        self.path_inches = path_inches
        self.windage_inches = windage_inches
        self.velocity_fps = velocity_fps
        self.energy = energy
        self.time_s = time_s
        self.mach = mach
        self.drop_from_bore = drop_from_bore


class BallisticSolver:
    """Mirror of `BallisticSolver` (Swift). Method names follow the Swift ones."""

    def __init__(self, projectile: Projectile, sight_height_inches: float, zero_range_yards: float,
                 conditions: Conditions):
        self.projectile = projectile
        self.sight_height_inches = sight_height_inches
        self.zero_range_yards = zero_range_yards
        self.conditions = conditions

        # --- Environment (precomputed once) ---
        ratio = density_ratio(conditions.temperature_f, conditions.pressure_inhg, conditions.humidity)
        self.speed_of_sound = speed_of_sound_fps(conditions.temperature_f)
        bc = projectile.bc if projectile.bc > 0 else 1e-6
        self.drag_factor = DRAG_CONSTANT * ratio / bc
        look = conditions.inclination_deg * math.pi / 180.0
        cos_look = math.cos(look)
        sin_look = math.sin(look)
        # Gravity in the line-of-sight frame (x along LOS, y perpendicular up).
        self.gravity_x = -GRAVITY_FPS2 * sin_look
        self.gravity_y = -GRAVITY_FPS2 * cos_look
        self.sight_height_ft = sight_height_inches / 12.0
        # Air-mass velocity in the LOS frame. The wind blows horizontally (world frame).
        # WindCondition.headwindMPH / .crosswindMPH
        head_fps = conditions.wind_mph * math.cos(conditions.wind_deg * math.pi / 180.0) * MPH_TO_FPS
        cross_fps = conditions.wind_mph * math.sin(conditions.wind_deg * math.pi / 180.0) * MPH_TO_FPS
        horizontal_air = -head_fps  # a headwind moves the air toward the shooter (-x)
        self.wind_x = horizontal_air * cos_look
        self.wind_y = -horizontal_air * sin_look
        self.wind_z = -cross_fps  # from the right (+cross) moves the air toward -z (left)

        # Zero on level ground in calm air (mirrors BallisticSolver.init); inclination applies to the shot only.
        if conditions.inclination_deg != 0.0:
            level = Conditions(conditions.altitude_ft, conditions.temperature_f, conditions.pressure_inhg,
                               conditions.humidity, 0.0, 90.0, 0.0)
            self.zero_angle = BallisticSolver(projectile, sight_height_inches, zero_range_yards, level).zero_angle
        else:
            self.zero_angle = self.solve_zero_angle()

    # MARK: public API --------------------------------------------------

    def zero_angle_radians(self):
        return self.zero_angle

    def trajectory(self, max_range_yards, step_yards):
        if not (step_yards > 0) or not math.isfinite(step_yards) or not (max_range_yards >= 0):
            return []
        samples = self.integrate(self.zero_angle, True, max_range_yards * 3.0, MINIMUM_PATH_INCHES / 12.0)
        rows = []
        count = int(math.floor(min(max_range_yards / step_yards + 1e-9, MAX_ROWS)))
        last_x = samples[-1].x
        for k in range(count + 1):
            yards = k * step_yards
            x = yards * 3.0
            if x > last_x + 1e-9:
                break  # trajectory terminated early (too slow / too low)
            rows.append(self.make_point(samples, x))
        return rows

    def point(self, at_yards):
        yards = at_yards if at_yards > 0 else 0.0  # also maps NaN to 0
        samples = self.integrate(self.zero_angle, True, yards * 3.0, MINIMUM_PATH_INCHES / 12.0)
        x = min(yards * 3.0, samples[-1].x)
        return self.make_point(samples, x)

    def expected_impact(self, at_yards):
        p = self.point(at_yards)
        return (p.windage_inches, p.path_inches)

    def max_point_blank_range(self, vital_zone_inches):
        if not (vital_zone_inches > 0):
            return (0.0, 0.0)
        half_ft = vital_zone_inches / 24.0
        cap_ft = 3000.0 * 3.0

        def apex_of(samples):
            best = -math.inf
            for s in samples:
                best = max(best, s.y - self.sight_height_ft)
            return best

        def run(angle):
            return self.integrate(angle, False, cap_ft, -half_ft)

        lo = 0.0
        lo_samples = run(lo)
        if apex_of(lo_samples) >= half_ft:
            return (0.0, 0.0)
        hi = 0.002
        hi_samples = run(hi)
        expansions = 0
        while apex_of(hi_samples) < half_ft and expansions < 12:
            lo = hi
            hi *= 2.0
            hi_samples = run(hi)
            expansions += 1
        if apex_of(hi_samples) < half_ft:
            return (0.0, 0.0)  # cannot raise the apex that high (should not happen)

        best_samples = hi_samples
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            mid_samples = run(mid)
            apex = apex_of(mid_samples)
            if apex < half_ft:
                lo = mid
            else:
                hi = mid
                best_samples = mid_samples
            if abs(apex - half_ft) < 1e-7 or hi - lo < 1e-12:
                best_samples = mid_samples
                break

        samples = best_samples
        # Index of the apex.
        apex_index = 0
        best = -math.inf
        for i, s in enumerate(samples):
            p = s.y - self.sight_height_ft
            if p > best:
                best = p
                apex_index = i
        zero_x = self.descending_crossing(samples, apex_index, 0.0)
        far_x = self.descending_crossing(samples, apex_index, -half_ft)
        return (zero_x / 3.0, far_x / 3.0)

    # MARK: internals ---------------------------------------------------

    def descending_crossing(self, samples, start, level_ft):
        """Range (ft) where path first falls through `level_ft` after `start`; last sample if never."""
        for i in range(start, len(samples) - 1):
            p0 = samples[i].y - self.sight_height_ft
            p1 = samples[i + 1].y - self.sight_height_ft
            if p0 >= level_ft and p1 < level_ft:
                f = (p0 - level_ft) / (p0 - p1)
                return samples[i].x + f * (samples[i + 1].x - samples[i].x)
        return samples[-1].x

    def solve_zero_angle(self):
        """Hybrid secant/bisection on the launch angle so path(zeroRange) == 0 in calm air."""
        range_ft = self.zero_range_yards * 3.0
        if not (range_ft > 0) or not (self.projectile.muzzle_velocity_fps > MINIMUM_VELOCITY_FPS):
            return 0.0
        tolerance = 1e-4  # inches

        def f(angle):
            return self.path_at(angle, range_ft)

        a0 = 0.0
        f0 = f(a0)
        if abs(f0) < tolerance:
            return a0
        a1 = min(max(-f0 / (range_ft * 12.0), -0.5), 0.5)
        f1 = f(a1)
        # Bracket: the highest angle known to print low (f < 0) and the lowest known to print high.
        neg_a = None
        pos_a = None
        for _ in range(60):
            if abs(f1) < tolerance:
                return a1
            for (a, fa) in ((a0, f0), (a1, f1)):
                if fa < 0:
                    if neg_a is None or a > neg_a:
                        neg_a = a
                else:
                    if pos_a is None or a < pos_a:
                        pos_a = a
            denom = f1 - f0
            a2 = a1 - f1 * (a1 - a0) / denom if denom != 0 else math.nan
            if neg_a is not None and pos_a is not None:
                lo = min(neg_a, pos_a)
                hi = max(neg_a, pos_a)
                if not math.isfinite(a2) or a2 <= lo or a2 >= hi:
                    a2 = 0.5 * (lo + hi)
            elif not math.isfinite(a2):
                a2 = a1 + 2.0 * (a1 - a0)
            a2 = min(max(a2, -0.5), 1.0)
            a0, f0 = a1, f1
            a1 = a2
            f1 = f(a1)
        return a1

    def path_at(self, angle, range_ft):
        """Calm-air path (inches) at `range_ft` for a launch angle; sentinel if never reached."""
        samples = self.integrate(angle, False, range_ft, -math.inf)
        last = samples[-1]
        if last.x < range_ft:
            return NOT_REACHED_PATH_INCHES
        y = self.interpolate_samples(samples, range_ft).y
        return (y - self.sight_height_ft) * 12.0

    def make_point(self, samples, x):
        s = self.interpolate_samples(samples, x)
        path = (s.y - self.sight_height_ft) * 12.0
        bore_y = s.x * math.tan(self.zero_angle)
        return TrajectoryPoint(
            range_yards=s.x / 3.0,
            path_inches=path,
            windage_inches=s.z * 12.0,
            velocity_fps=s.v,
            energy=energy_ft_lb(self.projectile.weight_grains, s.v),
            time_s=s.t,
            mach=s.v / self.speed_of_sound,
            drop_from_bore=min((s.y - bore_y) * 12.0, 0.0),
        )

    def interpolate_samples(self, samples, x):
        """Linear interpolation of a sample at downrange distance x (ft); clamps to the ends."""
        n = len(samples)
        if x <= samples[0].x:
            return samples[0]
        if x >= samples[n - 1].x:
            return samples[n - 1]
        lo = 0
        hi = n - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if samples[mid].x <= x:
                lo = mid
            else:
                hi = mid
        a = samples[lo]
        b = samples[hi]
        f = (x - a.x) / (b.x - a.x)
        return Sample(a.t + f * (b.t - a.t), x, a.y + f * (b.y - a.y), a.z + f * (b.z - a.z), a.v + f * (b.v - a.v))

    def integrate(self, angle, with_wind, max_range_ft, min_path_ft):
        """RK4 point-mass integration in the LOS frame. Returns every step (the first sample is the muzzle).

        Stops after the first sample at or beyond `max_range_ft`, or below `min_path_ft` while
        descending, or slower than MINIMUM_VELOCITY_FPS, or no longer moving downrange.
        """
        mv = self.projectile.muzzle_velocity_fps
        vx = mv * math.cos(angle)
        vy = mv * math.sin(angle)
        vz = 0.0
        x = 0.0
        y = 0.0
        z = 0.0
        t = 0.0
        wx = self.wind_x if with_wind else 0.0
        wy = self.wind_y if with_wind else 0.0
        wz = self.wind_z if with_wind else 0.0
        gx = self.gravity_x
        gy = self.gravity_y
        k = self.drag_factor
        c = self.speed_of_sound
        model = self.projectile.drag_model
        h = TIME_STEP
        sh = self.sight_height_ft

        def accel(ux, uy, uz):
            rx = ux - wx
            ry = uy - wy
            rz = uz - wz
            speed = math.sqrt(rx * rx + ry * ry + rz * rz)
            d = k * drag_coefficient(model, speed / c) * speed
            return (gx - d * rx, gy - d * ry, -d * rz)

        samples = [Sample(0.0, 0.0, 0.0, 0.0, mv)]
        steps = 0
        while steps < MAX_STEPS:
            steps += 1
            a1x, a1y, a1z = accel(vx, vy, vz)
            v2x = vx + 0.5 * h * a1x
            v2y = vy + 0.5 * h * a1y
            v2z = vz + 0.5 * h * a1z
            a2x, a2y, a2z = accel(v2x, v2y, v2z)
            v3x = vx + 0.5 * h * a2x
            v3y = vy + 0.5 * h * a2y
            v3z = vz + 0.5 * h * a2z
            a3x, a3y, a3z = accel(v3x, v3y, v3z)
            v4x = vx + h * a3x
            v4y = vy + h * a3y
            v4z = vz + h * a3z
            a4x, a4y, a4z = accel(v4x, v4y, v4z)

            x += h / 6.0 * (vx + 2.0 * v2x + 2.0 * v3x + v4x)
            y += h / 6.0 * (vy + 2.0 * v2y + 2.0 * v3y + v4y)
            z += h / 6.0 * (vz + 2.0 * v2z + 2.0 * v3z + v4z)
            vx += h / 6.0 * (a1x + 2.0 * a2x + 2.0 * a3x + a4x)
            vy += h / 6.0 * (a1y + 2.0 * a2y + 2.0 * a3y + a4y)
            vz += h / 6.0 * (a1z + 2.0 * a2z + 2.0 * a3z + a4z)
            t += h

            speed = math.sqrt(vx * vx + vy * vy + vz * vz)
            samples.append(Sample(t, x, y, z, speed))
            if x >= max_range_ft:
                break
            if speed < MINIMUM_VELOCITY_FPS or vx <= 0:
                break
            if vy < 0 and (y - sh) < min_path_ft:
                break
        return samples


# =============================================================================
# Comparison harness (py-ballisticcalc)
# =============================================================================

CASES = []


def add_case(name, bc, model, grains, diameter, mv, sight=1.5, zero=100.0, wind_mph=0.0, wind_deg=90.0,
             incl=0.0, alt=0.0, temp=59.0, press=29.92, hum=0.0):
    CASES.append(dict(name=name, bc=bc, model=model, grains=grains, diameter=diameter, mv=mv, sight=sight,
                      zero=zero, wind_mph=wind_mph, wind_deg=wind_deg, incl=incl, alt=alt, temp=temp,
                      press=press, hum=hum))


def build_cases():
    loads = [
        ("308_168_G1", 0.462, "g1", 168.0, 0.308, 2650.0, {}),
        ("308_168_G7", 0.224, "g7", 168.0, 0.308, 2650.0, {}),
        ("65CM_140_G7", 0.315, "g7", 140.0, 0.264, 2710.0, {}),
        ("223_55_G1", 0.243, "g1", 55.0, 0.224, 3240.0, {}),
        ("223_55_G1_z50_sh2.6", 0.243, "g1", 55.0, 0.224, 3240.0, dict(zero=50.0, sight=2.6)),
        ("22LR_40_G1_z50", 0.138, "g1", 40.0, 0.223, 1080.0, dict(zero=50.0)),
        ("300WM_180_G1", 0.507, "g1", 180.0, 0.308, 2960.0, {}),
        ("308_168_G1_up10", 0.462, "g1", 168.0, 0.308, 2650.0, dict(incl=10.0)),
        ("308_168_G1_6000ft", 0.462, "g1", 168.0, 0.308, 2650.0, dict(alt=6000.0, temp=40.0, press=24.0)),
        ("308_168_G1_hot_humid", 0.462, "g1", 168.0, 0.308, 2650.0, dict(temp=90.0, press=29.5, hum=80.0)),
    ]
    for name, bc, model, gr, dia, mv, extra in loads:
        add_case(name, bc, model, gr, dia, mv, **extra)
        add_case(name + "_wind10", bc, model, gr, dia, mv, wind_mph=10.0, wind_deg=90.0, **extra)
    # A quartering headwind exercises the head/tail component path too.
    add_case("308_168_G1_wind10_1030", 0.462, "g1", 168.0, 0.308, 2650.0, wind_mph=10.0, wind_deg=315.0)


def port_solver(case):
    proj = Projectile(case["bc"], case["model"], case["grains"], case["diameter"], case["mv"])
    cond = Conditions(case["alt"], case["temp"], case["press"], case["hum"], case["wind_mph"], case["wind_deg"],
                      case["incl"])
    return BallisticSolver(proj, case["sight"], case["zero"], cond)


def pbc_shot(case, calc_mod):
    from py_ballisticcalc import (Ammo, Atmo, DragModel, Shot, TableG1, TableG7, Unit, Weapon, Wind)
    table = TableG1 if case["model"] == "g1" else TableG7
    dm = DragModel(case["bc"], table, Unit.Grain(case["grains"]), Unit.Inch(case["diameter"]))
    ammo = Ammo(dm, Unit.FPS(case["mv"]))
    atmo = Atmo(altitude=Unit.Foot(case["alt"]), pressure=Unit.InHg(case["press"]),
                temperature=Unit.Fahrenheit(case["temp"]), humidity=case["hum"])
    # ZeroIn: degrees FROM, 90 = from the right. py-ballisticcalc: 0 = from behind, 90 = from the left.
    winds = [Wind(Unit.MPH(case["wind_mph"]), Unit.Degree((case["wind_deg"] + 180.0) % 360.0))]
    weapon = Weapon(sight_height=Unit.Inch(case["sight"]))
    return Shot(weapon=weapon, ammo=ammo, atmo=atmo, winds=winds, look_angle=Unit.Degree(case["incl"]))


def pbc_calculator():
    from py_ballisticcalc import Calculator
    # 0.0005 s step (same as ours), no velocity floor so subsonic .22 LR runs to 1000 yd.
    return Calculator(config={"cStepMultiplier": 0.2, "cMinimumVelocity": 0.0})


def pbc_zero_in_calm(case):
    """py-ballisticcalc zeros with the case's winds and look angle; ZeroIn zeros in calm air on level
    ground (what a shooter does at the range). Zero calm and level, then add wind and inclination."""
    from py_ballisticcalc import Unit, Angular
    calm = dict(case)
    calm["wind_mph"] = 0.0
    calm["incl"] = 0.0
    calc = pbc_calculator()
    shot = pbc_shot(calm, None)
    zero = calc.set_weapon_zero(shot, Unit.Yard(case["zero"]))
    return zero >> Angular.Radian


def pbc_rows(case, ranges):
    from py_ballisticcalc import Unit, Distance, Velocity
    zero_rad = pbc_zero_in_calm(case)
    calc = pbc_calculator()
    shot = pbc_shot(case, None)
    shot.weapon.zero_elevation = Unit.Radian(zero_rad)
    res = calc.fire(shot, Unit.Yard(max(ranges) + 5), Unit.Yard(5), dense_output=True)
    rows = []
    for r in ranges:
        if r == 0:
            rows.append((0.0, -case["sight"], 0.0, case["mv"], 0.0))
            continue
        p = res.get_at("slant_distance", Unit.Yard(r))
        rows.append((p.slant_distance >> Distance.Yard, p.slant_height >> Distance.Inch, p.windage >> Distance.Inch,
                     p.velocity >> Velocity.FPS, p.time))
    return zero_rad, rows


def pbc_mpbr(case, vital):
    """MPBR with py-ballisticcalc as the trajectory engine (same search as ours, on barrel angle)."""
    from py_ballisticcalc import Unit, Distance
    calc = pbc_calculator()
    shot = pbc_shot(case, None)
    half = vital / 2.0

    def run(angle):
        shot.weapon.zero_elevation = Unit.Radian(angle)
        res = calc.fire(shot, Unit.Yard(600), Unit.Foot(1), raise_range_error=False)
        rec = [(p.slant_distance >> Distance.Yard, p.slant_height >> Distance.Inch) for p in res.records]
        rec.sort()
        return rec

    def apex(rec):
        return max(h for _, h in rec)

    lo, hi = 0.0, 0.004
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if apex(run(mid)) < half:
            lo = mid
        else:
            hi = mid
    rec = run(0.5 * (lo + hi))
    ia = max(range(len(rec)), key=lambda i: rec[i][1])

    def cross(level):
        for i in range(ia, len(rec) - 1):
            (x0, p0), (x1, p1) = rec[i], rec[i + 1]
            if p0 >= level > p1:
                return x0 + (p0 - level) / (p0 - p1) * (x1 - x0)
        return rec[-1][0]

    return cross(0.0), cross(-half)


def within(ours, ref, abs_tol, rel_tol):
    return abs(ours - ref) <= max(abs_tol, rel_tol * abs(ref))


RANGES = list(range(0, 1001, 100))
CHECK_MAX_YARDS = 800


def run_comparison():
    build_cases()
    failures = []
    results = []
    print("ZeroIn port vs py-ballisticcalc (RK4, dt=0.0005 s).  path/drift in inches, velocity fps")
    print("tolerances (<= %d yd): path max(0.5 in, 1.5%%), drift max(0.5 in, 3%%), velocity 1%%" % CHECK_MAX_YARDS)
    for case in CASES:
        solver = port_solver(case)
        ours = solver.trajectory(max(RANGES), 100.0)
        zero_ref, ref = pbc_rows(case, RANGES)
        zero_ours = solver.zero_angle_radians()
        print()
        print("=== %s  (zero %.0f yd, sight %.1f in, wind %.0f mph @ %.0f deg, incl %.0f deg, %.0f ft %.0f F %.2f inHg %.0f%%)"
              % (case["name"], case["zero"], case["sight"], case["wind_mph"], case["wind_deg"], case["incl"],
                 case["alt"], case["temp"], case["press"], case["hum"]))
        zero_ok = within(zero_ours, zero_ref, 2e-6, 0.01)
        print("zero angle: ours %.7f rad  pbc %.7f rad  (%.3f MOA vs %.3f MOA) %s"
              % (zero_ours, zero_ref, zero_ours * 10800 / math.pi, zero_ref * 10800 / math.pi,
                 "ok" if zero_ok else "FAIL"))
        if not zero_ok:
            failures.append("%s zero angle" % case["name"])
        print("%5s | %9s %9s %7s | %8s %8s %6s | %7s %7s %6s | %6s %6s"
              % ("yd", "path", "pbc", "d", "drift", "pbc", "d", "vel", "pbc", "d%", "tof", "pbc"))
        max_dp = max_dw = max_dv = 0.0
        rows_out = []
        for i, r in enumerate(RANGES):
            if i >= len(ours):
                failures.append("%s: trajectory ended before %d yd" % (case["name"], r))
                break
            o = ours[i]
            ry, rp, rw, rv, rt = ref[i]
            dp = o.path_inches - rp
            dw = o.windage_inches - rw
            dv = (o.velocity_fps - rv) / rv * 100.0
            flag = ""
            if r <= CHECK_MAX_YARDS:
                max_dp = max(max_dp, abs(dp))
                max_dw = max(max_dw, abs(dw))
                max_dv = max(max_dv, abs(dv))
                ok = (within(o.path_inches, rp, 0.5, 0.015) and within(o.windage_inches, rw, 0.5, 0.03)
                      and within(o.velocity_fps, rv, 0.0, 0.01))
                if not ok:
                    flag = "  <-- FAIL"
                    failures.append("%s @ %d yd" % (case["name"], r))
            print("%5d | %9.2f %9.2f %7.2f | %8.2f %8.2f %6.2f | %7.1f %7.1f %6.2f | %6.3f %6.3f%s"
                  % (r, o.path_inches, rp, dp, o.windage_inches, rw, dw, o.velocity_fps, rv, dv, o.time_s, rt, flag))
            rows_out.append((r, rp, rw, rv, o.path_inches, o.windage_inches, o.velocity_fps))
        print("max |delta| <= %d yd: path %.3f in, drift %.3f in, velocity %.3f %%" % (CHECK_MAX_YARDS, max_dp, max_dw, max_dv))
        results.append(dict(case=case, zero_ref=zero_ref, zero_ours=zero_ours, rows=rows_out,
                            max_dp=max_dp, max_dw=max_dw, max_dv=max_dv))

    # --- MPBR (.308, 6" vital) ---
    print()
    mpbr_case = CASES[0]
    s = port_solver(mpbr_case)
    mz, mf = s.max_point_blank_range(6.0)
    pz, pf = pbc_mpbr(mpbr_case, 6.0)
    mpbr_ok = within(mz, pz, 1.0, 0.02) and within(mf, pf, 1.0, 0.015)
    print("MPBR .308 G1 6in vital: ours zero %.1f yd / max %.1f yd   pbc zero %.1f yd / max %.1f yd  %s"
          % (mz, mf, pz, pf, "ok" if mpbr_ok else "FAIL"))
    if not mpbr_ok:
        failures.append("MPBR")
    # Self-consistency: zeroing at the MPBR zero range puts the apex at +3 in.
    check = port_solver(dict(mpbr_case, zero=mz))
    apex = max(p.path_inches for p in check.trajectory(mf, 1.0))
    print("  re-zeroed at %.1f yd: apex %.3f in, path at %.1f yd = %.3f in"
          % (mz, apex, mf, check.point(mf).path_inches))

    # --- Atmosphere sanity ---
    print()
    print("density ratio std = %.6f, 5000 ft std = %.4f, speed of sound std = %.3f fps"
          % (density_ratio(59, 29.92, 0), density_ratio(*std_atmo(5000.0)), speed_of_sound_fps(59)))
    e25 = port_solver(CASES[0]).expected_impact(25.0)
    print("expected impact at 25 yd, .308 100-yd zero 1.5in: x %.3f y %.3f in" % e25)

    print()
    if failures:
        print("FAILED (%d):" % len(failures))
        for f in failures:
            print("  " + f)
    else:
        print("ALL CHECKS PASSED")
    return failures, results, (mz, mf, pz, pf)


def std_atmo(altitude):
    """Atmosphere.standard(atAltitudeFeet:) from BallisticTypes.swift."""
    temp_f = 59.0 - 0.003_566 * altitude
    temp_r = temp_f + 459.67
    pressure = 29.92 * math.pow(temp_r / 518.67, 5.2559)
    return temp_f, pressure, 0.0


# =============================================================================
# Swift vector emitter
# =============================================================================

SWIFT_BEGIN = "// BEGIN GENERATED REFERENCE VECTORS (tools/ballistics_reference.py --update-swift)"
SWIFT_END = "// END GENERATED REFERENCE VECTORS"


def swift_num(v, digits=6):
    """Fixed-point Swift Double literal (never exponent notation, always has a '.')."""
    text = ("%%.%df" % digits) % float(v)
    text = text.rstrip("0")
    if text.endswith("."):
        text += "0"
    if text in ("-0.0", "0.0"):
        return "0.0"
    return text


def emit_swift(results, mpbr):
    lines = [SWIFT_BEGIN, "// Do not edit by hand. `ref*` = py-ballisticcalc, `port*` = Python port of this solver.",
             "private let ballisticReferenceCases: [BallisticReferenceCase] = ["]
    for res in results:
        c = res["case"]
        lines.append("    BallisticReferenceCase(")
        lines.append('        name: "%s", bc: %s, model: .%s, weightGrains: %s, diameterInches: %s, muzzleVelocityFPS: %s,'
                     % (c["name"], swift_num(c["bc"]), c["model"], swift_num(c["grains"]), swift_num(c["diameter"]),
                        swift_num(c["mv"])))
        lines.append("        sightHeightInches: %s, zeroRangeYards: %s," % (swift_num(c["sight"]), swift_num(c["zero"])))
        lines.append("        altitudeFeet: %s, temperatureF: %s, pressureInHg: %s, humidityPercent: %s,"
                     % (swift_num(c["alt"]), swift_num(c["temp"]), swift_num(c["press"]), swift_num(c["hum"])))
        lines.append("        windMPH: %s, windDegrees: %s, inclinationDegrees: %s,"
                     % (swift_num(c["wind_mph"]), swift_num(c["wind_deg"]), swift_num(c["incl"])))
        lines.append("        refZeroAngle: %s, portZeroAngle: %s," % (swift_num(res["zero_ref"], 12),
                                                                     swift_num(res["zero_ours"], 12)))
        lines.append("        rows: [")
        for (r, rp, rw, rv, op, ow, ov) in res["rows"]:
            lines.append("            BallisticReferenceRow(yards: %s, refPath: %s, refWindage: %s, refVelocity: %s, "
                         "portPath: %s, portWindage: %s, portVelocity: %s),"
                         % (swift_num(r), swift_num(rp), swift_num(rw), swift_num(rv), swift_num(op), swift_num(ow),
                            swift_num(ov)))
        lines.append("        ]),")
    lines.append("]")
    mz, mf, pz, pf = mpbr
    lines.append("/// MPBR for `ballisticReferenceCases[0]` (.308 G1) with a 6-inch vital zone, yards.")
    lines.append("private let ballisticReferenceMPBR = BallisticReferenceMPBR(refZero: %s, refMax: %s, portZero: %s, portMax: %s)"
                 % (swift_num(pz), swift_num(pf), swift_num(mz), swift_num(mf)))
    lines.append(SWIFT_END)
    return "\n".join(lines)


def update_swift_file(block):
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "..", "ZeroInCore", "Tests", "ZeroInCoreTests", "BallisticsTests.swift")
    path = os.path.normpath(path)
    with open(path) as fh:
        text = fh.read()
    start = text.index(SWIFT_BEGIN)
    end = text.index(SWIFT_END) + len(SWIFT_END)
    text = text[:start] + block + text[end:]
    with open(path, "w") as fh:
        fh.write(text)
    print("updated %s" % path)


def port_only():
    build_cases()
    for case in CASES:
        s = port_solver(case)
        print("=== %s  zero %.7f rad" % (case["name"], s.zero_angle_radians()))
        for p in s.trajectory(1000, 100):
            print("%6.0f %9.2f %8.2f %7.1f %7.1f %6.3f %5.3f"
                  % (p.range_yards, p.path_inches, p.windage_inches, p.velocity_fps, p.energy, p.time_s, p.mach))


def main(argv):
    if "--port-only" in argv:
        port_only()
        return 0
    failures, results, mpbr = run_comparison()
    if "--update-swift" in argv:
        update_swift_file(emit_swift(results, mpbr))
    elif "--print-swift" in argv:
        print(emit_swift(results, mpbr))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
