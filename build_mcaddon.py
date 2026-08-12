from __future__ import annotations

import shutil
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "behavior_pack"
OUTPUT_DIR = ROOT / "build"


def build_release_name(prefix: str = "ConsiveTreeChopper") -> str:
    stamp = datetime.now().strftime("%Y-%m-%d")
    return f"{prefix}_{stamp}"


def clean_build_dir() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    for item in OUTPUT_DIR.iterdir():
        if item.name.startswith("."):
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        elif item.suffix.lower() in {".mcpack", ".mcaddon"}:
            if item.is_file():
                item.unlink()


def ensure_pack_structure() -> Path:
    staging = OUTPUT_DIR / ".staging_mcaddon"
    if staging.exists():
        shutil.rmtree(staging)

    staging.mkdir(parents=True, exist_ok=True)
    for item in sorted(SOURCE_DIR.iterdir()):
        target = staging / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)

    return staging


def build_mcpack(output_name: str | None = None) -> Path:
    OUTPUT_DIR.mkdir(exist_ok=True)
    name = output_name or build_release_name("ConsiveTreeChopper")
    output_path = OUTPUT_DIR / f"{name}.mcpack"

    if output_path.exists():
        output_path.unlink()

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for item in sorted(SOURCE_DIR.iterdir()):
            if item.is_dir():
                for file_path in sorted(item.rglob("*")):
                    if file_path.is_file():
                        zf.write(file_path, file_path.relative_to(SOURCE_DIR).as_posix())
            else:
                zf.write(item, item.name)

    return output_path


def build_mcaddon(output_name: str | None = None) -> Path:
    OUTPUT_DIR.mkdir(exist_ok=True)
    name = output_name or build_release_name("ConsiveTreeChopper")
    output_path = OUTPUT_DIR / f"{name}.mcaddon"

    if output_path.exists():
        output_path.unlink()

    staging = ensure_pack_structure()
    try:
        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for file_path in sorted(staging.rglob("*")):
                if file_path.is_file():
                    zf.write(file_path, file_path.relative_to(staging).as_posix())
    finally:
        if staging.exists():
            shutil.rmtree(staging)

    return output_path


if __name__ == "__main__":
    clean_build_dir()
    release_name = build_release_name("ConsiveTreeChopper")
    mcpack = build_mcpack(release_name)
    mcaddon = build_mcaddon(release_name)
    print(f".mcpack gerado em: {mcpack}")
    print(f".mcaddon gerado em: {mcaddon}")
    print("Use o .mcpack para o behavior pack puro e o .mcaddon para pacote combinado com resource pack.")
