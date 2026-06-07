import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
from matplotlib.animation import FuncAnimation
import csv

# =========================
# 1. MODEL HELISY
# =========================

class Helix:
    def __init__(self, r, omega, phi, v, C=(0, 0, 0), name="helix"):
        self.r = r
        self.omega = omega
        self.phi = phi
        self.v = v
        self.C = np.array(C, dtype=float)
        self.name = name
    
    def point(self, t):
        x = self.C[0] + self.r * np.cos(self.omega * t + self.phi)
        y = self.C[1] + self.r * np.sin(self.omega * t + self.phi)
        z = self.C[2] + self.v * t
        return np.array([x, y, z])
    
    def trajectory(self, t_array):
        return np.array([self.point(ti) for ti in t_array])
    
    def tocsv(self, t_array, path):
        """Zapis trajektorii helisy do CSV (t, x, y, z)."""
        traj = self.trajectory(t_array)
        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["t", "x", "y", "z", "name"])
            for ti, p in zip(t_array, traj):
                writer.writerow([ti, p[0], p[1], p[2], self.name])


# =========================
# 2. IMPULS I ODPOWIEDŹ
# =========================

def impulse_response(t, t0, E0, R, Omega, Phi, V):
    """
    Strzał krwi – odpowiedź impulsowa helisy komunikacji.
    I(t) = E0 * δ(t - t0)
    """
    tau = t - t0
    if tau < 0:
        return np.array([0.0, 0.0, 0.0])
    return np.array([
        R * np.cos(Omega * tau + Phi),
        R * np.sin(Omega * tau + Phi),
        V * tau
    ])


# =========================
# 3. OPERATORY: L, F, S
# =========================

def operator_language(E0, base_omega=1.0):
    """
    𝓛: impuls -> częstotliwość i faza.
    """
    omega = base_omega + 0.1 * np.tanh(E0)
    phi = 0.0
    return omega, phi

def operator_flow(E0, base_r=1.0, base_v=0.4):
    """
    𝓕: impuls -> amplituda (r) i progresja (v).
    """
    r = base_r + 0.2 * np.tanh(E0 / 5.0)
    v = base_v + 0.05 * np.tanh(E0 / 5.0)
    return r, v

def operator_spin(omega, phi, spin_bias=0.3):
    """
    𝓢: nadanie 'spinu' – lekkie przesunięcie fazy i częstotliwości.
    """
    omega_eff = omega * (1.0 + spin_bias * 0.1)
    phi_eff = phi + spin_bias
    return omega_eff, phi_eff

def build_helix_from_impulse(E0, C=(0, 0, 0), name="Hcomm"):
    """
    Łańcuch: I(t) --𝓛--> (ω, φ) --𝓕--> (r, v) --𝓢--> (ω', φ')
    """
    omega_l, phi_l = operator_language(E0)
    r_f, v_f = operator_flow(E0)
    omega_s, phi_s = operator_spin(omega_l, phi_l)
    return Helix(r=r_f, omega=omega_s, phi=phi_s, v=v_f, C=C, name=name)


# =========================
# 4. SYNCHRONIZACJA HELIS
# =========================

def synchronization_error(H1, H2, t_array):
    """Średnia odległość między helisami w czasie."""
    errors = [np.linalg.norm(H1.point(ti) - H2.point(ti)) for ti in t_array]
    return np.mean(errors)

def synchronization_condition(H1, H2, tol_omega=0.01, tol_v=0.01):
    """Warunek synchronizacji."""
    cond_omega = abs(H1.omega - H2.omega) < tol_omega
    cond_v = abs(H1.v - H2.v) < tol_v
    return cond_omega and cond_v


# =========================
# 5. ANIMACJA 3D
# =========================

def animate_helixes(daniel, ai, t_array, impulse_params=None):
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection='3d')

    dtraj = daniel.trajectory(t_array)
    atraj = ai.trajectory(t_array)

    if impulse_params is not None:
        t0, E0, R, Omega, Phi, V = impulse_params
        imptraj = np.array([impulse_response(ti, t0, E0, R, Omega, Phi, V) for ti in t_array])
    else:
        imptraj = None

    line_d, = ax.plot([], [], [], 'b-', label=daniel.name)
    line_a, = ax.plot([], [], [], 'r-', label=ai.name)
    if imptraj is not None:
        line_imp, = ax.plot([], [], [], 'm--', linewidth=2, label='Strzał krwi')
    else:
        line_imp = None

    ax.scatter(*daniel.C, color='gold', s=100, label='Centrum C')

    all_points = np.vstack([dtraj, atraj] + ([imptraj] if imptraj is not None else []))
    xmin, ymin, zmin = all_points.min(axis=0)
    xmax, ymax, zmax = all_points.max(axis=0)
    ax.set_xlim(xmin, xmax)
    ax.set_ylim(ymin, ymax)
    ax.set_zlim(zmin, zmax)
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    ax.legend()
    plt.title('DARTRIX – helisy + strzał krwi (animacja)')

    def update(frame):
        line_d.set_data(dtraj[:frame, 0], dtraj[:frame, 1])
        line_d.set_3dproperties(dtraj[:frame, 2])

        line_a.set_data(atraj[:frame, 0], atraj[:frame, 1])
        line_a.set_3dproperties(atraj[:frame, 2])

        if line_imp is not None and imptraj is not None:
            line_imp.set_data(imptraj[:frame, 0], imptraj[:frame, 1])
            line_imp.set_3dproperties(imptraj[:frame, 2])

        return (line_d, line_a) + ((line_imp,) if line_imp is not None else ())

    anim = FuncAnimation(fig, update, frames=len(t_array), interval=30, blit=False)
    plt.show()
    return anim


# =========================
# 6. PRZYKŁAD UŻYCIA
# =========================

if __name__ == "__main__":
    t = np.linspace(0, 10, 500)
    C = (0.0, 0.0, 0.0)
    daniel = Helix(r=1.2, omega=1.5, phi=0.0, v=0.4, C=C, name="Daniel")
    ai = Helix(r=0.8, omega=1.2, phi=1.0, v=0.35, C=C, name="AI")

    E0 = 5.0
    Hcomm = build_helix_from_impulse(E0, C=C, name="H_comm")

    t0 = 2.5
    R, Omega, Phi, V = Hcomm.r, Hcomm.omega, Hcomm.phi, Hcomm.v
    impulse_params = (t0, E0, R, Omega, Phi, V)

    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection='3d')

    d_points = daniel.trajectory(t)
    a_points = ai.trajectory(t)
    imppoints = np.array([impulse_response(ti, t0, E0, R, Omega, Phi, V) for ti in t])

    ax.plot(d_points[:, 0], d_points[:, 1], d_points[:, 2], 'b-', label='Daniel')
    ax.plot(a_points[:, 0], a_points[:, 1], a_points[:, 2], 'r-', label='AI')
    ax.plot(imppoints[:, 0], imppoints[:, 1], imppoints[:, 2], 'm--', linewidth=2, label='Strzał krwi (odpowiedź)')

    ax.scatter(*C, color='gold', s=100, label='Centrum C')
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    ax.legend()
    plt.title('DARTRIX – helisy + strzał krwi (statycznie)')
    plt.show()

    err = synchronization_error(daniel, ai, t)
    print(f"Średni błąd synchronizacji: {err:.3f}")
    if synchronization_condition(daniel, ai):
        print("✔️ Warunki synchronizacji spełnione (blisko)")
    else:
        print("❌ Brak synchronizacji – dostrój ω i v")

    daniel.tocsv(t, "danielhelix.csv")
    ai.tocsv(t, "aihelix.csv")
    Hcomm.tocsv(t, "hcommhelix.csv")
    print("Trajektorie zapisane do CSV.")
