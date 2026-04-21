"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as THREE from "three"
import "./game.css"

// Planet data for educational content
const PLANET_DATA = [
  { name: "Mercurio", radius: 0.8, color: 0x9e9e9e, distance: 45, speed: 0.025, rotationSpeed: 0.002, tilt: 0.01, description: "El planeta más cercano al Sol", temperature: "430°C día / -180°C noche", diameter: "4.879 km", moons: 0, fact: "Un año dura solo 88 días terrestres" },
  { name: "Venus", radius: 1.4, color: 0xffcc66, distance: 70, speed: 0.018, rotationSpeed: 0.001, tilt: 0.03, description: "El planeta más caliente", temperature: "465°C", diameter: "12.104 km", moons: 0, fact: "Gira al revés que los demás planetas" },
  { name: "Tierra", radius: 1.5, color: 0x4a90d9, distance: 100, speed: 0.012, rotationSpeed: 0.02, tilt: 0.41, description: "Nuestro hogar", temperature: "15°C promedio", diameter: "12.742 km", moons: 1, fact: "El único planeta con vida conocida" },
  { name: "Marte", radius: 1.0, color: 0xc1440e, distance: 140, speed: 0.008, rotationSpeed: 0.019, tilt: 0.44, description: "El planeta rojo", temperature: "-65°C promedio", diameter: "6.779 km", moons: 2, fact: "Tiene las montañas más altas del sistema" },
  { name: "Júpiter", radius: 4.5, color: 0xd4a574, distance: 200, speed: 0.004, rotationSpeed: 0.04, tilt: 0.05, description: "El gigante gaseoso", temperature: "-110°C", diameter: "139.820 km", moons: 95, fact: "Es tan grande que caben 1.300 tierras" },
  { name: "Saturno", radius: 3.8, color: 0xf0d090, distance: 260, speed: 0.003, rotationSpeed: 0.038, tilt: 0.47, description: "El planeta de los anillos", temperature: "-140°C", diameter: "116.460 km", moons: 146, fact: "Sus anillos son de hielo y rocas" },
  { name: "Urano", radius: 2.5, color: 0x7de3e3, distance: 320, speed: 0.002, rotationSpeed: 0.028, tilt: 1.71, description: "Planeta inclinado", temperature: "-195°C", diameter: "50.724 km", moons: 28, fact: "Gira de lado" },
  { name: "Neptuno", radius: 2.4, color: 0x3e5fe3, distance: 380, speed: 0.001, rotationSpeed: 0.03, tilt: 0.49, description: "El planeta más lejano", temperature: "-200°C", diameter: "49.244 km", moons: 16, fact: "Tiene los vientos más fuertes del sistema" }
]

type Phase = "menu" | "launchpad" | "intro" | "cabin" | "countdown" | "launching" | "space"

interface PlanetInfo {
  name: string
  description: string
  temperature: string
  diameter: string
  moons: number | string
  fact: string
}

export default function SpaceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhaseState] = useState<Phase>("menu")
  const [hudStatus, setHudStatus] = useState("Pulsa \"Jugar\" para iniciar")
  const [isAlert, setIsAlert] = useState(false)
  const [speedValue, setSpeedValue] = useState(0)
  const [altValue, setAltValue] = useState(0)
  const [timeValue, setTimeValue] = useState("00:00")
  const [planetInfo, setPlanetInfo] = useState<PlanetInfo | null>(null)
  const [controlMode, setControlMode] = useState<"touch" | "keyboard">("keyboard")
  const [showSettings, setShowSettings] = useState(false)
  const controlModeRef = useRef<"touch" | "keyboard">("keyboard")

  // Refs for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const clockRef = useRef<THREE.Clock | null>(null)
  const rocketRef = useRef<THREE.Group | null>(null)
  const accentBodyRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const skyDomeRef = useRef<THREE.Mesh | null>(null)
  const starsRef = useRef<THREE.Points | null>(null)
  const cloudsRef = useRef<THREE.Group | null>(null)
  const cabinViewRef = useRef<THREE.Group | null>(null)
  const launchEffectsRef = useRef<THREE.Group | null>(null)
  const solarSystemRef = useRef<THREE.Group | null>(null)
  const planetsRef = useRef<THREE.Group[]>([])
  const asteroidBeltRef = useRef<THREE.Group | null>(null)
  const starfieldRef = useRef<THREE.Group | null>(null)

  // World state
  const worldRef = useRef({
    phase: "menu" as Phase,
    orbitAngle: Math.PI * 0.22,
    orbitRadius: 34,
    orbitHeight: 13,
    lookTarget: new THREE.Vector3(0, 7.5, 0),
    isRocketHovered: false,
    statusTimer: null as ReturnType<typeof setTimeout> | null,
    lastHoverCheck: 0,
    introStartTime: 0,
    introComplete: false,
    launchStartTime: 0,
    countdownStartTime: 0,
    isLaunching: false,
    spaceEntered: false,
    currentSpeed: 0,
    currentAlt: 0,
  })

  // Camera controls for space phase
  const cameraControlsRef = useRef({
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    cameraRotation: { x: 0, y: 0 },
    targetCameraRotation: { x: 0, y: 0 },
    cameraDistance: 120,
    targetDistance: 120,
    spaceTargetPosition: new THREE.Vector3(120, 30, 120),
    touchStartDistance: 0,
    // Keyboard/mouse first-person controls
    keys: {
      w: false, a: false, s: false, d: false,
      space: false, shift: false,
    },
    yaw: 0,      // horizontal look (radians)
    pitch: 0,    // vertical look (radians)
    pointerLocked: false,
    moveSpeed: 50, // units per second
    lookSensitivity: 0.002,
  })

  // Performance settings
  const performanceModeRef = useRef(false)
  const qualityRef = useRef({
    antialias: true,
    enableShadows: true,
    maxPixelRatio: 1.5,
    minPixelRatio: 0.85,
    dynamicResolution: true,
    starCount: 1800,
    cloudCount: 30,
    cloudPuffBase: 4,
    cloudPuffRange: 3,
    cloudSphereSegments: 16,
    groundSegments: 130,
    mountainCount: 42,
    mountainSegments: 9,
    treeCount: 180,
    shrubCount: 140,
    targetFpsMin: 34,
    targetFpsMax: 58,
    shadowMapSize: 2048,
  })

  // Keep control mode ref in sync
  useEffect(() => {
    controlModeRef.current = controlMode
    if (typeof window !== "undefined") {
      try { localStorage.setItem("spaceGameControlMode", controlMode) } catch {}
    }
  }, [controlMode])

  // Load control mode on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("spaceGameControlMode")
        if (saved === "touch" || saved === "keyboard") {
          setControlMode(saved)
        }
      } catch {}
    }
  }, [])

  const setPhase = useCallback((nextPhase: Phase) => {
    worldRef.current.phase = nextPhase
    setPhaseState(nextPhase)

    const scene = sceneRef.current
    const rocket = rocketRef.current
    const cabinView = cabinViewRef.current
    const launchEffects = launchEffectsRef.current
    const skyDome = skyDomeRef.current
    const stars = starsRef.current
    const camera = cameraRef.current

    if (!scene) return

    const launchpadGroup = scene.getObjectByName("launchpad")
    const environmentGroup = scene.children.find(c => c.name === "environment")
    const skyVisible = nextPhase === "menu" || nextPhase === "launchpad" || nextPhase === "intro" || nextPhase === "countdown" || nextPhase === "launching"

    if (launchpadGroup) launchpadGroup.visible = skyVisible || nextPhase === "launching" || nextPhase === "countdown"
    if (environmentGroup) environmentGroup.visible = skyVisible || nextPhase === "launching" || nextPhase === "countdown"
    if (rocket) rocket.visible = skyVisible || nextPhase === "launching" || nextPhase === "countdown"
    if (cabinView) cabinView.visible = nextPhase === "launching" || nextPhase === "space"
    if (launchEffects) launchEffects.visible = nextPhase === "launching"

    if (nextPhase === "menu") {
      setHudStatus("Pulsa \"Jugar\" para iniciar")
      setIsAlert(false)
    } else if (nextPhase === "launchpad") {
      setHudStatus("Toca el cohete para entrar en la nave")
      setIsAlert(false)
    } else if (nextPhase === "intro") {
      setHudStatus("Entrando en la cabina de mando...")
      setIsAlert(false)
      worldRef.current.introStartTime = performance.now() / 1000
      worldRef.current.introComplete = false
    } else if (nextPhase === "cabin") {
      setHudStatus("Pulsa el botón rojo para despegar")
      setIsAlert(false)
      if (cabinView) cabinView.visible = true
      if (skyDome) skyDome.visible = true
      if (stars) stars.visible = true
      if (camera) {
        // Camera positioned as if sitting in the seat, looking up and forward
        camera.position.set(0, 0.6, -0.3) // Seated position
        camera.lookAt(0, 2.5, 1.2) // Looking up towards window and control panel
        camera.fov = 85 // Wide FOV for immersive cockpit feel
        camera.updateProjectionMatrix()
      }
      if (launchpadGroup) launchpadGroup.visible = false
      if (environmentGroup) environmentGroup.visible = false
      if (rocket) rocket.visible = false
    } else if (nextPhase === "launching") {
      setHudStatus("¡DESPEGANDO!")
      setIsAlert(true)
      worldRef.current.launchStartTime = performance.now() / 1000
      worldRef.current.isLaunching = true
      if (launchEffects) launchEffects.visible = true
    } else if (nextPhase === "countdown") {
      setHudStatus("Iniciando motores...")
      setIsAlert(true)
      worldRef.current.countdownStartTime = performance.now() / 1000
      if (launchpadGroup) launchpadGroup.visible = true
      if (environmentGroup) environmentGroup.visible = true
      if (rocket) {
        rocket.visible = true
        rocket.position.y = 1
      }
      if (skyDome) skyDome.visible = true
    } else if (nextPhase === "space") {
      setHudStatus("Arrastra para mirar. Pellizca para zoom. Toca un planeta.")
      setIsAlert(false)
      worldRef.current.isLaunching = false

      if (launchpadGroup) launchpadGroup.visible = false
      if (environmentGroup) environmentGroup.visible = false
      if (rocket) rocket.visible = false
      if (cabinView) cabinView.visible = false
      if (skyDome) skyDome.visible = false

      if (camera) {
        camera.fov = 65
        camera.updateProjectionMatrix()
      }
    }
  }, [])

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return

    // Check performance
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 4
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    const autoLowSpec = hardwareConcurrency <= 6 || deviceMemory <= 4
    performanceModeRef.current = autoLowSpec

    if (autoLowSpec) {
      qualityRef.current = {
        antialias: false,
        enableShadows: false,
        maxPixelRatio: 1,
        minPixelRatio: 0.58,
        dynamicResolution: true,
        starCount: 760,
        cloudCount: 12,
        cloudPuffBase: 3,
        cloudPuffRange: 2,
        cloudSphereSegments: 9,
        groundSegments: 58,
        mountainCount: 24,
        mountainSegments: 7,
        treeCount: 72,
        shrubCount: 64,
        targetFpsMin: 28,
        targetFpsMax: 50,
        shadowMapSize: 1024,
      }
    }

    const QUALITY = qualityRef.current
    const performanceMode = performanceModeRef.current

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: QUALITY.antialias,
      powerPreference: "high-performance",
      precision: "mediump",
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    let currentPixelRatio = Math.min(window.devicePixelRatio, QUALITY.maxPixelRatio)
    renderer.setPixelRatio(currentPixelRatio)
    renderer.shadowMap.enabled = QUALITY.enableShadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f1f4f)
    scene.fog = new THREE.Fog(0x0f1f4f, 92, 360)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(34, 13, 30)
    cameraRef.current = camera

    // Clock
    const clock = new THREE.Clock()
    clockRef.current = clock

    // Lights
    const ambient = new THREE.AmbientLight(0x7588cb, 0.62)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xa5bfff, 0x284228, 0.52)
    scene.add(hemi)

    const keyLight = new THREE.DirectionalLight(0xfff2cf, 1.24)
    keyLight.position.set(32, 42, 16)
    keyLight.castShadow = QUALITY.enableShadows
    if (QUALITY.enableShadows) {
      keyLight.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize)
      keyLight.shadow.camera.near = 5
      keyLight.shadow.camera.far = 220
      keyLight.shadow.camera.left = -46
      keyLight.shadow.camera.right = 46
      keyLight.shadow.camera.top = 46
      keyLight.shadow.camera.bottom = -46
    }
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x5f92ff, 0.44)
    fillLight.position.set(-36, 22, -34)
    scene.add(fillLight)

    // Helper functions
    function getTerrainHeight(x: number, z: number) {
      const radial = Math.sqrt(x * x + z * z)
      const waveA = Math.sin(x * 0.047) * Math.cos(z * 0.041) * 1.25
      const waveB = Math.sin(x * 0.013 + z * 0.024) * 1.8
      const waveC = Math.cos(z * 0.031) * 0.8
      const dome = Math.max(0, radial - 20) * 0.014
      const flattenFactor = radial < 24 ? 0.2 : 1
      return (waveA + waveB + waveC + dome) * flattenFactor
    }

    function createBeamBetweenPoints(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material, radialSegments = 8) {
      const vector = new THREE.Vector3().subVectors(end, start)
      const length = Math.max(vector.length(), 0.001)
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, radialSegments),
        material,
      )
      beam.position.copy(start).add(end).multiplyScalar(0.5)
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize())
      beam.castShadow = QUALITY.enableShadows
      return beam
    }

    // Sky dome
    function createSkyDome() {
      const skyGeometry = new THREE.SphereGeometry(560, performanceMode ? 20 : 40, performanceMode ? 14 : 26)
      const skyMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(0x071337) },
          midColor: { value: new THREE.Color(0x14356e) },
          horizonColor: { value: new THREE.Color(0x28529b) },
          bottomColor: { value: new THREE.Color(0x1f4f44) },
          offset: { value: 70.0 },
          exponent: { value: 0.64 },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 horizonColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;

          void main() {
            float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
            float upper = max(pow(max(h, 0.0), exponent), 0.0);
            float lower = smoothstep(-0.3, 0.15, h);
            vec3 base = mix(bottomColor, horizonColor, lower);
            vec3 upperBlend = mix(midColor, topColor, smoothstep(0.25, 0.95, h));
            vec3 color = mix(base, upperBlend, upper);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      })

      const dome = new THREE.Mesh(skyGeometry, skyMaterial)
      dome.position.y = -36
      scene.add(dome)
      return dome
    }

    // Stars
    function createStars() {
      const geometry = new THREE.BufferGeometry()
      const count = QUALITY.starCount
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      const palette = [
        new THREE.Color(0xdde7ff),
        new THREE.Color(0xbfd4ff),
        new THREE.Color(0x8fb0ff),
      ]

      for (let i = 0; i < count; i += 1) {
        const distance = 180 + Math.random() * 250
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        positions[i * 3] = distance * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = distance * Math.cos(phi) * 0.8 + 140
        positions[i * 3 + 2] = distance * Math.sin(phi) * Math.sin(theta)

        const color = palette[Math.floor(Math.random() * palette.length)]
        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

      const material = new THREE.PointsMaterial({
        size: performanceMode ? 1.35 : 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      })

      const stars = new THREE.Points(geometry, material)
      scene.add(stars)
      return stars
    }

    // Moon
    function createMoon() {
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(7.5, performanceMode ? 18 : 28, performanceMode ? 18 : 28),
        new THREE.MeshStandardMaterial({
          color: 0xf1f3ff,
          emissive: 0xb4c5ff,
          emissiveIntensity: 0.24,
          roughness: 0.78,
          metalness: 0.02,
        }),
      )
      moon.position.set(-124, 104, -84)
      scene.add(moon)

      if (!performanceMode) {
        const moonGlow = new THREE.PointLight(0x9bb6ff, 0.42, 320, 1.8)
        moonGlow.position.copy(moon.position)
        scene.add(moonGlow)
      }
    }

    // Clouds
    function createCloudBand() {
      const cloudGroup = new THREE.Group()
      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xc8dbff,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity: 0.58,
      })

      for (let i = 0; i < QUALITY.cloudCount; i += 1) {
        const cloud = new THREE.Group()
        const puffCount = QUALITY.cloudPuffBase + Math.floor(Math.random() * QUALITY.cloudPuffRange)
        for (let p = 0; p < puffCount; p += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(2, QUALITY.cloudSphereSegments, QUALITY.cloudSphereSegments),
            cloudMaterial,
          )
          const scaleX = 1 + Math.random() * 1.6
          const scaleY = 0.6 + Math.random() * 0.5
          const scaleZ = 0.7 + Math.random() * 1.2
          puff.scale.set(scaleX, scaleY, scaleZ)
          puff.position.set(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 1.4,
            (Math.random() - 0.5) * 2.4,
          )
          cloud.add(puff)
        }

        const angle = (i / QUALITY.cloudCount) * Math.PI * 2
        const radius = 74 + Math.random() * 34
        cloud.position.set(
          Math.cos(angle) * radius,
          16 + Math.random() * 5,
          Math.sin(angle) * radius,
        )
        cloud.rotation.y = Math.random() * Math.PI * 2
        cloudGroup.add(cloud)
      }

      scene.add(cloudGroup)
      return cloudGroup
    }

    // Environment
    function createEnvironment() {
      const environment = new THREE.Group()
      environment.name = "environment"

      const groundGeometry = new THREE.PlaneGeometry(420, 420, QUALITY.groundSegments, QUALITY.groundSegments)
      const positions = groundGeometry.attributes.position
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i)
        const z = positions.getY(i)
        positions.setZ(i, getTerrainHeight(x, z))
      }
      groundGeometry.computeVertexNormals()

      const ground = new THREE.Mesh(
        groundGeometry,
        new THREE.MeshStandardMaterial({
          color: 0x2f6135,
          roughness: 0.95,
          metalness: 0,
          flatShading: true,
        }),
      )
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = QUALITY.enableShadows
      environment.add(ground)

      const grassRing = new THREE.Mesh(
        new THREE.RingGeometry(20, 72, performanceMode ? 56 : 100),
        new THREE.MeshStandardMaterial({
          color: 0x3d7a3f,
          roughness: 0.92,
          metalness: 0,
          side: THREE.DoubleSide,
        }),
      )
      grassRing.rotation.x = -Math.PI / 2
      grassRing.position.y = 0.11
      environment.add(grassRing)

      const roadRing = new THREE.Mesh(
        new THREE.RingGeometry(30, 35, performanceMode ? 52 : 90),
        new THREE.MeshStandardMaterial({
          color: 0x4f5f70,
          roughness: 0.84,
          metalness: 0.09,
          side: THREE.DoubleSide,
        }),
      )
      roadRing.rotation.x = -Math.PI / 2
      roadRing.position.y = 0.12
      environment.add(roadRing)

      // Mountains
      const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0x334f3f,
        roughness: 0.96,
        metalness: 0,
        flatShading: true,
      })

      const snowMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8f0ff,
        roughness: 0.9,
        metalness: 0,
        flatShading: true,
      })

      for (let i = 0; i < QUALITY.mountainCount; i += 1) {
        const angle = (i / QUALITY.mountainCount) * Math.PI * 2
        const distance = 128 + Math.random() * 44
        const height = 20 + Math.random() * 44
        const radius = 9 + Math.random() * 11
        const mountain = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, QUALITY.mountainSegments),
          mountainMaterial,
        )
        mountain.position.set(
          Math.cos(angle) * distance,
          height * 0.5 - 1.2,
          Math.sin(angle) * distance,
        )
        mountain.castShadow = QUALITY.enableShadows && !performanceMode
        mountain.receiveShadow = QUALITY.enableShadows && !performanceMode
        environment.add(mountain)

        if (height > 45) {
          const snow = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 0.42, height * 0.22, QUALITY.mountainSegments),
            snowMaterial,
          )
          snow.position.set(mountain.position.x, height * 0.76, mountain.position.z)
          environment.add(snow)
        }
      }

      // Trees
      const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.22, 2.2, performanceMode ? 5 : 7)
      const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x6a4527,
        roughness: 0.92,
        flatShading: true,
      })

      const foliageGeometry = new THREE.ConeGeometry(1, 1.6, performanceMode ? 6 : 8)
      const foliageMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x2f7b38, roughness: 0.9, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x368c43, roughness: 0.9, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x2f7141, roughness: 0.9, flatShading: true }),
      ]

      function createTree(scale: number) {
        const tree = new THREE.Group()
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
        trunk.position.y = 1.1
        trunk.castShadow = QUALITY.enableShadows && !performanceMode
        tree.add(trunk)

        for (let i = 0; i < 3; i += 1) {
          const cone = new THREE.Mesh(
            foliageGeometry,
            foliageMaterials[Math.floor(Math.random() * foliageMaterials.length)],
          )
          cone.position.y = 1.9 + i * 0.84
          cone.scale.set(1 - i * 0.2, 1, 1 - i * 0.2)
          cone.castShadow = QUALITY.enableShadows && !performanceMode
          tree.add(cone)
        }
        tree.scale.setScalar(scale)
        return tree
      }

      for (let i = 0; i < QUALITY.treeCount; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const distance = 34 + Math.random() * 140
        const x = Math.cos(angle) * distance
        const z = Math.sin(angle) * distance
        const scale = 0.8 + Math.random() * 1.3
        const tree = createTree(scale)
        tree.position.set(x, getTerrainHeight(x, z), z)
        tree.rotation.y = Math.random() * Math.PI * 2
        environment.add(tree)
      }

      // Shrubs
      const shrubGeometry = new THREE.DodecahedronGeometry(performanceMode ? 0.72 : 0.64, 0)
      const shrubMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a8542,
        roughness: 0.96,
        flatShading: true,
      })

      for (let i = 0; i < QUALITY.shrubCount; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const distance = 26 + Math.random() * 150
        const x = Math.cos(angle) * distance
        const z = Math.sin(angle) * distance
        const shrub = new THREE.Mesh(shrubGeometry, shrubMaterial)
        shrub.scale.setScalar(0.65 + Math.random() * 1.2)
        shrub.position.set(x, getTerrainHeight(x, z) + 0.25, z)
        shrub.castShadow = QUALITY.enableShadows && !performanceMode
        environment.add(shrub)
      }

      scene.add(environment)
    }

    // Launchpad
    function createLaunchpad() {
      const launchpad = new THREE.Group()
      launchpad.name = "launchpad"

      const padBase = new THREE.Mesh(
        new THREE.CylinderGeometry(16, 17.4, 1.6, performanceMode ? 30 : 56),
        new THREE.MeshStandardMaterial({
          color: 0x8f97a7,
          roughness: 0.86,
          metalness: 0.1,
          flatShading: true,
        }),
      )
      padBase.position.y = 0.8
      padBase.receiveShadow = true
      padBase.castShadow = true
      launchpad.add(padBase)

      const topDeck = new THREE.Mesh(
        new THREE.CylinderGeometry(15.4, 15.8, 0.3, performanceMode ? 30 : 56),
        new THREE.MeshStandardMaterial({
          color: 0xa5afc0,
          roughness: 0.8,
          metalness: 0.16,
          flatShading: true,
        }),
      )
      topDeck.position.y = 1.74
      topDeck.receiveShadow = true
      launchpad.add(topDeck)

      const centerPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(6.9, 7.3, 0.32, performanceMode ? 24 : 40),
        new THREE.MeshStandardMaterial({
          color: 0x1f2531,
          roughness: 0.7,
          metalness: 0.28,
        }),
      )
      centerPlate.position.y = 1.9
      launchpad.add(centerPlate)

      const ringMark = new THREE.Mesh(
        new THREE.TorusGeometry(9.6, 0.26, performanceMode ? 8 : 12, performanceMode ? 42 : 72),
        new THREE.MeshStandardMaterial({
          color: 0xffd268,
          emissive: 0xffc454,
          emissiveIntensity: 0.25,
          roughness: 0.5,
          metalness: 0.22,
        }),
      )
      ringMark.position.y = 1.99
      ringMark.rotation.x = Math.PI / 2
      launchpad.add(ringMark)

      // Stripes
      const stripeMaterial = new THREE.MeshStandardMaterial({
        color: 0xdce5f5,
        roughness: 0.74,
        metalness: 0.2,
      })
      for (let i = 0; i < 8; i += 1) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 8), stripeMaterial)
        const angle = (i / 8) * Math.PI * 2
        stripe.position.set(Math.cos(angle) * 12.1, 1.98, Math.sin(angle) * 12.1)
        stripe.rotation.y = angle
        launchpad.add(stripe)
      }

      // Beacons
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2
        const lightPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 1, 8),
          new THREE.MeshStandardMaterial({ color: 0x5d6779, roughness: 0.6, metalness: 0.3 }),
        )
        lightPost.position.set(Math.cos(angle) * 15.2, 2.26, Math.sin(angle) * 15.2)
        launchpad.add(lightPost)

        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, performanceMode ? 7 : 10, performanceMode ? 7 : 10),
          new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0x9ac0ff : 0xffd774,
            emissive: i % 2 === 0 ? 0x5b80dd : 0xa77518,
            emissiveIntensity: 0.55,
          }),
        )
        beacon.position.set(Math.cos(angle) * 15.2, 2.82, Math.sin(angle) * 15.2)
        launchpad.add(beacon)
      }

      // === U-SHAPED LATTICE LAUNCH TOWER (SpaceX/Saturn V style) ===
      const tower = new THREE.Group()
      const towerMaterial = new THREE.MeshStandardMaterial({
        color: 0xa8b0bc,
        roughness: 0.5,
        metalness: 0.55,
      })

      const darkTowerMaterial = new THREE.MeshStandardMaterial({
        color: 0x6a7380,
        roughness: 0.6,
        metalness: 0.45,
      })

      const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x8a92a0,
        roughness: 0.58,
        metalness: 0.35,
      })

      const handrailMaterial = new THREE.MeshStandardMaterial({
        color: 0xf4c74f,
        roughness: 0.4,
        metalness: 0.22,
      })

      // U-shape: 3 vertical corner legs (open toward the rocket)
      // Legs arranged so tower opens toward rocket (+X direction is where rocket will be)
      // Tower is placed to the side of the rocket
      // U opens in +X direction (toward rocket)
      const towerHeight = 30
      const towerWidth = 3.2  // distance between side legs
      const towerDepth = 3.2  // distance front-to-back

      // 4 legs but we'll only cross-brace 3 sides (leaving the rocket-facing side open for U shape)
      const legPositions: Array<[number, number, string]> = [
        [-towerWidth / 2, -towerDepth / 2, "back-left"],
        [towerWidth / 2, -towerDepth / 2, "back-right"],
        [-towerWidth / 2, towerDepth / 2, "front-left"],  // These two face rocket
        [towerWidth / 2, towerDepth / 2, "front-right"],
      ]

      // Main vertical legs (like lattice columns)
      for (const [x, z] of legPositions) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, towerHeight, 0.35),
          towerMaterial,
        )
        leg.position.set(x, towerHeight / 2, z)
        leg.castShadow = true
        tower.add(leg)
      }

      // Helper to add X-cross braces on a face of the tower
      function addXBrace(
        y1: number, y2: number,
        p1: [number, number], p2: [number, number],
      ) {
        // Diagonal 1: p1 top -> p2 bottom
        const d1Start = new THREE.Vector3(p1[0], y2, p1[1])
        const d1End = new THREE.Vector3(p2[0], y1, p2[1])
        const d1 = createBeamBetweenPoints(d1Start, d1End, 0.06, darkTowerMaterial, 6)
        tower.add(d1)

        // Diagonal 2: p1 bottom -> p2 top
        const d2Start = new THREE.Vector3(p1[0], y1, p1[1])
        const d2End = new THREE.Vector3(p2[0], y2, p2[1])
        const d2 = createBeamBetweenPoints(d2Start, d2End, 0.06, darkTowerMaterial, 6)
        tower.add(d2)
      }

      // Helper to add horizontal beam
      function addHorizontalBeam(
        y: number,
        p1: [number, number], p2: [number, number],
        material: THREE.Material = towerMaterial,
        radius: number = 0.08,
      ) {
        const beam = createBeamBetweenPoints(
          new THREE.Vector3(p1[0], y, p1[1]),
          new THREE.Vector3(p2[0], y, p2[1]),
          radius,
          material,
          6,
        )
        tower.add(beam)
      }

      // Lattice pattern - every 2.5 units of height
      const sectionHeight = 2.5
      for (let i = 0; i < Math.floor(towerHeight / sectionHeight); i++) {
        const y1 = i * sectionHeight
        const y2 = (i + 1) * sectionHeight

        // Horizontal rings at each section (all 4 sides)
        addHorizontalBeam(y2, [-towerWidth / 2, -towerDepth / 2], [towerWidth / 2, -towerDepth / 2]) // back
        addHorizontalBeam(y2, [-towerWidth / 2, -towerDepth / 2], [-towerWidth / 2, towerDepth / 2]) // left
        addHorizontalBeam(y2, [towerWidth / 2, -towerDepth / 2], [towerWidth / 2, towerDepth / 2])   // right
        // NOTE: No horizontal on the front (rocket-facing side) - this makes the U shape

        // X-brace on 3 sides (not the front)
        // Back face
        addXBrace(y1, y2,
          [-towerWidth / 2, -towerDepth / 2],
          [towerWidth / 2, -towerDepth / 2])

        // Left side
        addXBrace(y1, y2,
          [-towerWidth / 2, -towerDepth / 2],
          [-towerWidth / 2, towerDepth / 2])

        // Right side
        addXBrace(y1, y2,
          [towerWidth / 2, -towerDepth / 2],
          [towerWidth / 2, towerDepth / 2])
      }

      // Top horizontal frame on the front (U shape completion at top)
      addHorizontalBeam(towerHeight - 0.2, [-towerWidth / 2, towerDepth / 2], [towerWidth / 2, towerDepth / 2], towerMaterial, 0.1)

      // Base plate
      const basePlate = new THREE.Mesh(
        new THREE.BoxGeometry(towerWidth + 0.8, 0.3, towerDepth + 0.8),
        darkTowerMaterial,
      )
      basePlate.position.set(0, 0.15, 0)
      basePlate.castShadow = true
      tower.add(basePlate)

      // === GANTRY ARMS (extending from tower toward rocket) ===
      // Three gantry arms at different heights (umbilical arms)
      const gantryHeights = [7, 12, 17]
      const gantryLength = 5.5  // distance from tower to rocket

      for (const gy of gantryHeights) {
        const gantryGroup = new THREE.Group()

        // Main arm structure (two parallel beams)
        for (const offset of [-0.4, 0.4]) {
          const armBeam = new THREE.Mesh(
            new THREE.BoxGeometry(gantryLength, 0.2, 0.15),
            towerMaterial,
          )
          armBeam.position.set(gantryLength / 2 + towerWidth / 2, 0, offset)
          armBeam.castShadow = true
          gantryGroup.add(armBeam)
        }

        // Cross braces on arm
        const crossCount = 3
        for (let c = 0; c <= crossCount; c++) {
          const xPos = towerWidth / 2 + (c / crossCount) * gantryLength
          const cross = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.12, 0.9),
            towerMaterial,
          )
          cross.position.set(xPos, 0, 0)
          gantryGroup.add(cross)
        }

        // Diagonals on arm (side view)
        const diag1 = createBeamBetweenPoints(
          new THREE.Vector3(towerWidth / 2, 0, -0.4),
          new THREE.Vector3(towerWidth / 2 + gantryLength, 0, 0.4),
          0.05, darkTowerMaterial, 6,
        )
        gantryGroup.add(diag1)

        const diag2 = createBeamBetweenPoints(
          new THREE.Vector3(towerWidth / 2, 0, 0.4),
          new THREE.Vector3(towerWidth / 2 + gantryLength, 0, -0.4),
          0.05, darkTowerMaterial, 6,
        )
        gantryGroup.add(diag2)

        // Platform at end of gantry (where it meets rocket)
        const gantryEndPlatform = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.12, 1.4),
          platformMaterial,
        )
        gantryEndPlatform.position.set(towerWidth / 2 + gantryLength - 0.2, 0.1, 0)
        gantryEndPlatform.castShadow = true
        gantryGroup.add(gantryEndPlatform)

        // Railings around the end platform
        for (const side of [-0.6, 0.6]) {
          const rail = createBeamBetweenPoints(
            new THREE.Vector3(towerWidth / 2 + gantryLength - 0.8, 0.8, side),
            new THREE.Vector3(towerWidth / 2 + gantryLength + 0.4, 0.8, side),
            0.04, handrailMaterial, 6,
          )
          gantryGroup.add(rail)
        }
        // Front rail
        const frontGantryRail = createBeamBetweenPoints(
          new THREE.Vector3(towerWidth / 2 + gantryLength + 0.4, 0.8, -0.6),
          new THREE.Vector3(towerWidth / 2 + gantryLength + 0.4, 0.8, 0.6),
          0.04, handrailMaterial, 6,
        )
        gantryGroup.add(frontGantryRail)

        gantryGroup.position.y = gy
        tower.add(gantryGroup)
      }

      // === TOP PLATFORM (crane/hammerhead area) ===
      const topPlatform = new THREE.Mesh(
        new THREE.BoxGeometry(towerWidth + 0.8, 0.3, towerDepth + 0.8),
        platformMaterial,
      )
      topPlatform.position.set(0, towerHeight + 0.15, 0)
      topPlatform.castShadow = true
      tower.add(topPlatform)

      // Crane arm at top
      const craneArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, gantryLength + 2),
        towerMaterial,
      )
      craneArm.rotation.y = 0
      craneArm.position.set(towerWidth / 2 + gantryLength / 2, towerHeight + 0.8, towerDepth / 2 + 0.5)
      tower.add(craneArm)

      // Crane support struts
      const craneSupport1 = createBeamBetweenPoints(
        new THREE.Vector3(towerWidth / 2, towerHeight + 0.3, towerDepth / 2),
        new THREE.Vector3(towerWidth / 2 + gantryLength, towerHeight + 0.65, towerDepth / 2 + 0.5),
        0.08, darkTowerMaterial, 6,
      )
      tower.add(craneSupport1)

      // Antenna
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xb0b8c4, roughness: 0.5, metalness: 0.5 }),
      )
      antenna.position.set(-towerWidth / 2 + 0.3, towerHeight + 2.3, -towerDepth / 2 + 0.3)
      tower.add(antenna)

      const antennaLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0xff807f,
          emissive: 0xff3f3f,
          emissiveIntensity: 0.8,
        }),
      )
      antennaLight.position.set(-towerWidth / 2 + 0.3, towerHeight + 4.5, -towerDepth / 2 + 0.3)
      tower.add(antennaLight)

      // Position the tower so the U opens toward the rocket
      // Rocket is at (0,0,0), tower is offset to the -X side
      // The U-shape gantry arms extend in +X direction
      tower.position.set(-8.5, 0, 0)
      launchpad.add(tower)
      scene.add(launchpad)
    }

    // Launch effects
    function createLaunchEffects() {
      const launchEffects = new THREE.Group()
      launchEffects.name = "launch-effects"
      launchEffects.visible = false

      const particleCount = 80

      launchEffects.userData = {
        particleCount,
        particles: [] as THREE.Mesh[],
      }

      const smokeMaterial = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.4,
      })

      const fireMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8844,
        transparent: true,
        opacity: 0.7,
      })

      for (let i = 0; i < particleCount; i++) {
        const isFire = i < particleCount * 0.5
        const material = isFire ? fireMaterial.clone() : smokeMaterial.clone()
        const size = isFire ? 0.2 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4

        const particle = new THREE.Mesh(
          new THREE.SphereGeometry(size, performanceMode ? 6 : 10, performanceMode ? 6 : 10),
          material
        )
        particle.castShadow = false
        particle.receiveShadow = false
        particle.visible = false
        particle.userData = {
          isFire,
          maxOpacity: isFire ? 0.7 : 0.4,
          size,
        }

        launchEffects.add(particle)
        launchEffects.userData.particles.push(particle)
      }

      scene.add(launchEffects)
      return launchEffects
    }

    // Cabin view - Redesigned to look like sitting inside looking UP
    function createCabinView() {
      const cabinGroup = new THREE.Group()
      cabinGroup.name = "cabin-view"

      // Materials
      const darkMetalMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1f2e,
        roughness: 0.7,
        metalness: 0.5,
      })

      const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d3748,
        roughness: 0.6,
        metalness: 0.4,
      })

      const lightMetalMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a5568,
        roughness: 0.5,
        metalness: 0.6,
      })

      const screenMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a1a2a,
        emissive: 0x0d3050,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.3,
      })

      const greenLedMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff66,
        emissive: 0x00ff44,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      })

      const yellowLedMaterial = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.8,
        roughness: 0.3,
      })

      const orangeLedMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        emissive: 0xff6600,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      })

      const blueLedMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x0088dd,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      })

      // === CABIN INTERIOR WALLS ===
      // Cylindrical cabin interior
      const cabinWallGeometry = new THREE.CylinderGeometry(2.2, 2.4, 4, 32, 1, true)
      const cabinWall = new THREE.Mesh(cabinWallGeometry, darkMetalMaterial)
      cabinWall.position.set(0, 2, 0)
      cabinGroup.add(cabinWall)

      // Cabin floor (we're sitting on this)
      const cabinFloor = new THREE.Mesh(
        new THREE.CircleGeometry(2.3, 32),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 })
      )
      cabinFloor.rotation.x = -Math.PI / 2
      cabinFloor.position.y = 0
      cabinGroup.add(cabinFloor)

      // === LARGE WINDOW ABOVE (looking up at sky/space) ===
      const windowGeometry = new THREE.CircleGeometry(1.6, 32)
      const windowGlassMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a3050,
        emissive: 0x0a2040,
        emissiveIntensity: 0.4,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85,
      })
      const windowGlass = new THREE.Mesh(windowGeometry, windowGlassMaterial)
      windowGlass.position.set(0, 3.95, 0)
      windowGlass.rotation.x = -Math.PI / 2
      cabinGroup.add(windowGlass)

      // Window frame
      const windowFrameGeometry = new THREE.TorusGeometry(1.65, 0.12, 16, 48)
      const windowFrame = new THREE.Mesh(windowFrameGeometry, lightMetalMaterial)
      windowFrame.position.set(0, 3.9, 0)
      windowFrame.rotation.x = Math.PI / 2
      cabinGroup.add(windowFrame)

      // Cross-bars on window
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI
        const crossBar = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.06, 0.06),
          lightMetalMaterial
        )
        crossBar.position.set(0, 3.92, 0)
        crossBar.rotation.y = angle
        cabinGroup.add(crossBar)
      }

      // === MAIN CONTROL PANEL (in front, angled towards us) ===
      const mainPanelWidth = 3.6
      const mainPanelHeight = 1.4
      const mainPanel = new THREE.Mesh(
        new THREE.BoxGeometry(mainPanelWidth, mainPanelHeight, 0.15),
        panelMaterial
      )
      mainPanel.position.set(0, 1.0, 1.8)
      mainPanel.rotation.x = -0.5 // Angled towards the seated position
      cabinGroup.add(mainPanel)

      // Panel frame/border
      const panelBorderMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d4852,
        roughness: 0.4,
        metalness: 0.5,
      })
      const panelBorderTop = new THREE.Mesh(
        new THREE.BoxGeometry(mainPanelWidth + 0.1, 0.08, 0.2),
        panelBorderMaterial
      )
      panelBorderTop.position.set(0, 1.65, 1.55)
      panelBorderTop.rotation.x = -0.5
      cabinGroup.add(panelBorderTop)

      // === CENTRAL DISPLAY SCREEN ===
      const screenWidth = 1.4
      const screenHeight = 0.7
      const screenFrame = new THREE.Mesh(
        new THREE.BoxGeometry(screenWidth + 0.1, screenHeight + 0.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x0f0f1a, roughness: 0.5 })
      )
      screenFrame.position.set(0, 1.25, 1.72)
      screenFrame.rotation.x = -0.5
      cabinGroup.add(screenFrame)

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(screenWidth, screenHeight),
        screenMaterial
      )
      screen.position.set(0, 1.26, 1.69)
      screen.rotation.x = -0.5
      cabinGroup.add(screen)

      // === BIG RED LAUNCH BUTTON (center, prominent) ===
      const launchButtonMaterial = new THREE.MeshStandardMaterial({
        color: 0xff2222,
        emissive: 0xcc0000,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.5,
      })

      // Button housing/guard
      const buttonHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.24, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 })
      )
      buttonHousing.position.set(0, 0.58, 1.88)
      buttonHousing.rotation.x = -0.5
      cabinGroup.add(buttonHousing)

      // The big red button
      const launchButton = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.1, 24),
        launchButtonMaterial
      )
      launchButton.position.set(0, 0.62, 1.85)
      launchButton.rotation.x = -0.5
      launchButton.name = "launch-button"
      cabinGroup.add(launchButton)

      // Hazard stripes around button
      const hazardMaterial = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        roughness: 0.5,
      })
      for (let i = 0; i < 8; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.12, 0.02),
          i % 2 === 0 ? hazardMaterial : new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
        )
        const angle = (i / 8) * Math.PI * 2
        stripe.position.set(
          Math.cos(angle) * 0.28,
          0.58 + Math.sin(-0.5) * 0.01,
          1.88 + Math.cos(-0.5) * Math.sin(angle) * 0.28
        )
        stripe.rotation.x = -0.5
        stripe.rotation.y = angle
        cabinGroup.add(stripe)
      }

      // === LEFT SIDE CONTROLS ===
      // Small buttons row
      const smallButtonColors = [greenLedMaterial, greenLedMaterial, yellowLedMaterial, orangeLedMaterial]
      for (let i = 0; i < 4; i++) {
        const btn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12),
          smallButtonColors[i]
        )
        btn.position.set(-1.1 + i * 0.15, 0.75, 1.82)
        btn.rotation.x = -0.5
        cabinGroup.add(btn)
      }

      // Toggle switches (left side)
      const switchBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 })
      const switchToggleMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 })

      for (let i = 0; i < 3; i++) {
        // Switch base
        const switchBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.12, 0.04),
          switchBaseMaterial
        )
        switchBase.position.set(-1.4 + i * 0.2, 1.1, 1.78)
        switchBase.rotation.x = -0.5
        cabinGroup.add(switchBase)

        // Switch toggle
        const toggle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8),
          switchToggleMaterial
        )
        toggle.position.set(-1.4 + i * 0.2, 1.15, 1.75)
        toggle.rotation.x = -0.5 + (i === 1 ? 0.4 : -0.2) // Some up, some down
        cabinGroup.add(toggle)
      }

      // === RIGHT SIDE CONTROLS ===
      // Knobs/dials
      for (let i = 0; i < 2; i++) {
        // Dial base
        const dialBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16),
          switchBaseMaterial
        )
        dialBase.position.set(1.1 + i * 0.35, 1.0, 1.8)
        dialBase.rotation.x = -0.5
        cabinGroup.add(dialBase)

        // Dial knob
        const dialKnob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.07, 0.05, 16),
          lightMetalMaterial
        )
        dialKnob.position.set(1.1 + i * 0.35, 1.04, 1.77)
        dialKnob.rotation.x = -0.5
        cabinGroup.add(dialKnob)

        // Dial indicator line
        const dialLine = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.04, 0.02),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        )
        dialLine.position.set(1.1 + i * 0.35, 1.06, 1.75)
        dialLine.rotation.x = -0.5
        dialLine.rotation.z = i * 0.8 // Different positions
        cabinGroup.add(dialLine)
      }

      // More LED indicators on right
      for (let i = 0; i < 3; i++) {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 8, 8),
          i === 0 ? greenLedMaterial : (i === 1 ? blueLedMaterial : yellowLedMaterial)
        )
        led.position.set(1.0 + i * 0.12, 0.7, 1.85)
        cabinGroup.add(led)
      }

      // === LEVER/THROTTLE on right side ===
      const leverBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.2, 0.1),
        switchBaseMaterial
      )
      leverBase.position.set(1.5, 0.65, 1.9)
      leverBase.rotation.x = -0.5
      cabinGroup.add(leverBase)

      const leverHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 })
      )
      leverHandle.position.set(1.5, 0.78, 1.82)
      leverHandle.rotation.x = -0.3
      cabinGroup.add(leverHandle)

      const leverKnob = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 })
      )
      leverKnob.position.set(1.5, 0.9, 1.78)
      cabinGroup.add(leverKnob)

      // === SIDE PANELS with more instruments ===
      // Left side panel
      const sidePanelLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.5, 0.1),
        panelMaterial
      )
      sidePanelLeft.position.set(-1.9, 1.2, 0.5)
      sidePanelLeft.rotation.y = 0.4
      cabinGroup.add(sidePanelLeft)

      // Small gauge on left panel
      const gaugeFrame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 })
      )
      gaugeFrame.position.set(-1.85, 1.5, 0.55)
      gaugeFrame.rotation.z = Math.PI / 2
      gaugeFrame.rotation.y = 0.4
      cabinGroup.add(gaugeFrame)

      const gaugeFace = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 20),
        new THREE.MeshStandardMaterial({ color: 0x111118, emissive: 0x0a0a12, emissiveIntensity: 0.3 })
      )
      gaugeFace.position.set(-1.82, 1.5, 0.57)
      gaugeFace.rotation.y = 0.4
      cabinGroup.add(gaugeFace)

      // Right side panel
      const sidePanelRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.5, 0.1),
        panelMaterial
      )
      sidePanelRight.position.set(1.9, 1.2, 0.5)
      sidePanelRight.rotation.y = -0.4
      cabinGroup.add(sidePanelRight)

      // === SEAT (visible at bottom of view) ===
      const seatMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d3748,
        roughness: 0.85,
        metalness: 0.1,
      })

      // Seat cushion
      const seatCushion = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.15, 0.8),
        seatMaterial
      )
      seatCushion.position.set(0, 0.1, -0.2)
      cabinGroup.add(seatCushion)

      // Seat back (angled for looking up)
      const seatBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.2, 0.12),
        seatMaterial
      )
      seatBack.position.set(0, 0.5, -0.55)
      seatBack.rotation.x = 0.35 // Reclined for looking up
      cabinGroup.add(seatBack)

      // Armrests
      for (const side of [-1, 1]) {
        const armrest = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.15, 0.6),
          lightMetalMaterial
        )
        armrest.position.set(side * 0.55, 0.25, -0.1)
        cabinGroup.add(armrest)
      }

      // === LIGHTING ===
      const mainLight = new THREE.PointLight(0x4488cc, 0.5, 6)
      mainLight.position.set(0, 3.5, 0)
      cabinGroup.add(mainLight)

      const panelLight = new THREE.PointLight(0x88aaff, 0.3, 4)
      panelLight.position.set(0, 1.5, 1.5)
      cabinGroup.add(panelLight)

      // Ambient glow from instruments
      const instrumentGlow = new THREE.PointLight(0x00ff88, 0.15, 3)
      instrumentGlow.position.set(-1, 0.8, 1.6)
      cabinGroup.add(instrumentGlow)

      scene.add(cabinGroup)
      return cabinGroup
    }

    // Rocket
    function createRocket() {
      const rocket = new THREE.Group()

      // Cartoon style materials
      const whiteBody = new THREE.MeshStandardMaterial({
        color: 0xf5f7fa,
        roughness: 0.35,
        metalness: 0.12,
      })

      // Pink/red accent color (fins, nose)
      const pinkAccent = new THREE.MeshStandardMaterial({
        color: 0xe85a7c,
        roughness: 0.45,
        metalness: 0.1,
        emissive: 0x4a1220,
        emissiveIntensity: 0.1,
      })

      // Store as accentBody for compatibility (hover effects)
      const accentBody = pinkAccent

      // Main body - rounded cylinder tapering slightly at bottom
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 9, performanceMode ? 20 : 32),
        whiteBody,
      )
      body.position.y = 6.5
      body.castShadow = true
      rocket.add(body)

      // Rounded bottom cap
      const bodyBottom = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, performanceMode ? 20 : 32, performanceMode ? 10 : 16, 0, Math.PI * 2, 0, Math.PI / 2),
        whiteBody,
      )
      bodyBottom.position.y = 2
      bodyBottom.rotation.x = Math.PI
      bodyBottom.castShadow = true
      rocket.add(bodyBottom)

      // Pink nose cone (rounded/bullet shape)
      const noseGeom = new THREE.ConeGeometry(1.6, 4, performanceMode ? 20 : 32)
      // Modify vertices to make bullet shape
      const nose = new THREE.Mesh(noseGeom, pinkAccent)
      nose.position.y = 13
      nose.castShadow = true
      rocket.add(nose)

      // Round tip sphere on nose
      const noseTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, performanceMode ? 12 : 20, performanceMode ? 12 : 20),
        pinkAccent,
      )
      noseTip.position.y = 14.9
      rocket.add(noseTip)

      // Big circular window in center of body (cartoon style)
      // Window frame (ring sticking out)
      const windowOuterFrame = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.25, performanceMode ? 12 : 16, performanceMode ? 20 : 32),
        new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.4, metalness: 0.3 }),
      )
      windowOuterFrame.rotation.y = Math.PI / 2
      windowOuterFrame.position.set(0, 7, 1.55)
      rocket.add(windowOuterFrame)

      // Window inner frame
      const windowInnerFrame = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.08, performanceMode ? 10 : 14, performanceMode ? 18 : 28),
        new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.3, metalness: 0.5 }),
      )
      windowInnerFrame.rotation.y = Math.PI / 2
      windowInnerFrame.position.set(0, 7, 1.72)
      rocket.add(windowInnerFrame)

      // Window glass (dark blue/purple, round)
      const windowGlass = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, performanceMode ? 20 : 32),
        new THREE.MeshStandardMaterial({
          color: 0x6a5aa8,
          emissive: 0x3a2a78,
          emissiveIntensity: 0.45,
          roughness: 0.12,
          metalness: 0.7,
        }),
      )
      windowGlass.position.set(0, 7, 1.7)
      rocket.add(windowGlass)

      // Highlight/shine on window
      const windowShine = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, performanceMode ? 12 : 20),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.25,
        }),
      )
      windowShine.position.set(-0.15, 7.2, 1.73)
      rocket.add(windowShine)

      // Pink fins at the base (cartoon style - chunky curved fins)
      // Using a rounded shape
      const finShape = new THREE.Shape()
      finShape.moveTo(0, 0)
      finShape.lineTo(1.5, -0.2)
      finShape.lineTo(1.8, 2.5)
      finShape.quadraticCurveTo(1.2, 3.2, 0.3, 2.8)
      finShape.lineTo(0, 2.2)
      finShape.lineTo(0, 0)

      const finGeometry = new THREE.ExtrudeGeometry(finShape, {
        depth: 0.5,
        bevelEnabled: !performanceMode,
        bevelThickness: 0.12,
        bevelSize: 0.12,
        bevelSegments: performanceMode ? 1 : 3,
      })

      // 3 fins distributed around (cartoon style uses 3 or 4)
      const finCount = 3
      for (let i = 0; i < finCount; i += 1) {
        const fin = new THREE.Mesh(finGeometry, pinkAccent)
        fin.rotation.y = (i / finCount) * Math.PI * 2
        fin.position.y = 1.2
        fin.translateZ(1.4)
        fin.translateX(-0.25)
        fin.castShadow = true
        rocket.add(fin)
      }

      // Engine nozzle (single big one, bottom center)
      const engineNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.2, 1.5, performanceMode ? 16 : 24),
        new THREE.MeshStandardMaterial({
          color: 0xcbd0d8,
          roughness: 0.4,
          metalness: 0.6,
        }),
      )
      engineNozzle.position.y = 0.5
      rocket.add(engineNozzle)

      // Engine inner (darker)
      const engineInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 1.0, 1.3, performanceMode ? 14 : 20),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a35,
          roughness: 0.6,
          metalness: 0.3,
        }),
      )
      engineInner.position.y = 0.55
      rocket.add(engineInner)

      // Hit area - larger for easier clicking
      const rocketHitArea = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 16, performanceMode ? 8 : 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      )
      rocketHitArea.position.y = 7.5
      rocketHitArea.name = "rocket-hit-area"
      rocket.add(rocketHitArea)

      rocket.position.y = 1
      scene.add(rocket)

      return { rocket, accentBody }
    }

    // Solar system
    function createSolarSystem() {
      const solarSystem = new THREE.Group()
      solarSystem.name = "solar-system"

      const sunLight = new THREE.PointLight(0xfff4e0, 2.5, 600)
      sunLight.position.set(0, 0, 0)
      solarSystem.add(sunLight)

      const sunMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdd44,
        emissive: 0xffaa22,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      })
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(8, performanceMode ? 24 : 40, performanceMode ? 24 : 40),
        sunMaterial
      )
      sun.position.set(0, 0, 0)
      sun.name = "sun-hit-area"
      solarSystem.add(sun)

      const sunGlow = new THREE.Mesh(
        new THREE.SphereGeometry(10, performanceMode ? 18 : 32, performanceMode ? 18 : 32),
        new THREE.MeshBasicMaterial({
          color: 0xffaa33,
          transparent: true,
          opacity: 0.15,
        })
      )
      sunGlow.position.set(0, 0, 0)
      solarSystem.add(sunGlow)

      const planets: THREE.Group[] = []

      PLANET_DATA.forEach((data, index) => {
        const planetGroup = new THREE.Group()
        planetGroup.name = `planet-${index}`
        const initialAngle = Math.random() * Math.PI * 2
        planetGroup.userData = { ...data, index, angle: initialAngle, orbitAngle: initialAngle }

        const geometry = new THREE.SphereGeometry(data.radius, performanceMode ? 18 : 32, performanceMode ? 14 : 24)
        const material = new THREE.MeshStandardMaterial({
          color: data.color,
          roughness: 0.8,
          metalness: 0.1,
        })
        const planet = new THREE.Mesh(geometry, material)
        planet.name = `planet-hit-${index}`
        planetGroup.add(planet)

        if (data.name === "Saturno") {
          const ringGeometry = new THREE.TorusGeometry(data.radius * 1.6, data.radius * 0.4, 2, performanceMode ? 32 : 64)
          const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xc8b896,
            roughness: 0.9,
            metalness: 0.05,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
          })
          const ring = new THREE.Mesh(ringGeometry, ringMaterial)
          ring.rotation.x = Math.PI / 2
          ring.name = "saturn-ring"
          planetGroup.add(ring)
        }

        planetGroup.position.set(
          Math.cos(initialAngle) * data.distance,
          0,
          Math.sin(initialAngle) * data.distance
        )

        planets.push(planetGroup)
        solarSystem.add(planetGroup)
      })

      planetsRef.current = planets
      scene.add(solarSystem)
      return solarSystem
    }

    // Asteroid belt
    function createAsteroidBelt() {
      const asteroidBelt = new THREE.Group()
      asteroidBelt.name = "asteroid-belt"

      const asteroidMaterial = new THREE.MeshStandardMaterial({
        color: 0x6b6b6b,
        roughness: 0.95,
        flatShading: true,
      })

      const count = performanceMode ? 80 : 180
      const innerRadius = 160
      const outerRadius = 190

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = innerRadius + Math.random() * (outerRadius - innerRadius)
        const size = 0.3 + Math.random() * 1.2

        const asteroid = new THREE.Mesh(
          new THREE.DodecahedronGeometry(size, 0),
          asteroidMaterial
        )
        asteroid.position.set(
          Math.cos(angle) * distance,
          (Math.random() - 0.5) * 8,
          Math.sin(angle) * distance
        )
        asteroid.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        )
        asteroid.userData = {
          orbitAngle: angle,
          orbitDistance: distance,
          rotationSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
          )
        }
        asteroidBelt.add(asteroid)
      }

      scene.add(asteroidBelt)
      return asteroidBelt
    }

    // Space starfield
    function createSpaceStarfield() {
      const starfield = new THREE.Group()
      starfield.name = "space-starfield"

      const geometry = new THREE.BufferGeometry()
      const count = QUALITY.starCount * 2
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)

      const palette = [
        new THREE.Color(0xffffff),
        new THREE.Color(0xffffee),
        new THREE.Color(0xe8f0ff),
        new THREE.Color(0xffe8d0),
      ]

      for (let i = 0; i < count; i++) {
        const distance = 400 + Math.random() * 200
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)

        positions[i * 3] = distance * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = distance * Math.cos(phi)
        positions[i * 3 + 2] = distance * Math.sin(phi) * Math.sin(theta)

        const color = palette[Math.floor(Math.random() * palette.length)]
        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

      const material = new THREE.PointsMaterial({
        size: performanceMode ? 1.8 : 2.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
      })

      const stars = new THREE.Points(geometry, material)
      starfield.add(stars)

      scene.add(starfield)
      return starfield
    }

    // Create all scene elements
    const skyDome = createSkyDome()
    const stars = createStars()
    createMoon()
    createEnvironment()
    const clouds = createCloudBand()
    createLaunchpad()
    const cabinView = createCabinView()
    const launchEffects = createLaunchEffects()
    const { rocket, accentBody } = createRocket()

    skyDomeRef.current = skyDome
    starsRef.current = stars
    cloudsRef.current = clouds
    cabinViewRef.current = cabinView
    launchEffectsRef.current = launchEffects
    rocketRef.current = rocket
    accentBodyRef.current = accentBody

    cabinView.visible = false

    // Raycaster and pointer
    const pointer = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()

    function updatePointerPosition(clientX: number, clientY: number) {
      pointer.x = (clientX / window.innerWidth) * 2 - 1
      pointer.y = -((clientY / window.innerHeight) * 2 - 1)
    }

    // Event handlers
    function handlePointerDown(event: PointerEvent | TouchEvent) {
      const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX
      const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY
      if (clientX == null || clientY == null) return

      updatePointerPosition(clientX, clientY)
      raycaster.setFromCamera(pointer, camera)

      if (worldRef.current.phase === "launchpad") {
        const hits = raycaster.intersectObject(rocket, true)
        const clickedRocket = hits.some((hit) => hit.object.name === "rocket-hit-area")
        if (clickedRocket) {
          setHudStatus("Iniciando secuencia de entrada...")
          setIsAlert(true)
          setTimeout(() => {
            if (worldRef.current.phase === "launchpad") {
              setPhase("intro")
            }
          }, 800)
        }
      } else if (worldRef.current.phase === "space") {
        if (solarSystemRef.current) {
          const hits = raycaster.intersectObjects(solarSystemRef.current.children, true)

          for (const hit of hits) {
            const name = hit.object.name
            if (name && name.startsWith("planet-hit-")) {
              const index = parseInt(name.replace("planet-hit-", ""), 10)
              const planetGroup = planetsRef.current[index]
              if (planetGroup) {
                const data = planetGroup.userData
                setPlanetInfo({
                  name: data.name,
                  description: data.description,
                  temperature: data.temperature,
                  diameter: data.diameter,
                  moons: data.moons,
                  fact: data.fact,
                })
                return
              }
            }
            if (name === "sun-hit-area") {
              setPlanetInfo({
                name: "Sol",
                description: "Estrella central del sistema solar",
                temperature: "5.500°C superficie",
                diameter: "1.392.700 km",
                moons: "8 planetas",
                fact: "Es tan grande que caben 1.3 millones de tierras"
              })
              return
            }
          }

          setPlanetInfo(null)
        }
      }
    }

    function handlePointerMove(event: PointerEvent | TouchEvent) {
      const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX
      const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY
      if (clientX == null || clientY == null) return

      const controls = cameraControlsRef.current

      // Only handle drag-to-look in touch mode
      if (worldRef.current.phase === "space" && controls.isDragging && controlModeRef.current === "touch") {
        const deltaX = clientX - controls.previousMousePosition.x
        const deltaY = clientY - controls.previousMousePosition.y

        controls.cameraRotation.x += deltaX * 0.005
        controls.cameraRotation.y += deltaY * 0.005
        controls.cameraRotation.y = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, controls.cameraRotation.y))

        controls.previousMousePosition = { x: clientX, y: clientY }
      } else if (worldRef.current.phase === "launchpad") {
        updatePointerPosition(clientX, clientY)
        raycaster.setFromCamera(pointer, camera)
        const hits = raycaster.intersectObject(rocket, true)
        const isHovered = hits.some((hit) => hit.object.name === "rocket-hit-area")
        worldRef.current.isRocketHovered = isHovered

        if (isHovered) {
          setHudStatus("Cohete detectado: toca para entrar")
        } else {
          setHudStatus("Toca el cohete para entrar en la nave")
        }
      }
    }

    // Keyboard/mouse FPS-style look
    function handleMouseMove(event: MouseEvent) {
      const controls = cameraControlsRef.current
      if (worldRef.current.phase === "space" && controlModeRef.current === "keyboard" && controls.pointerLocked) {
        controls.yaw -= event.movementX * controls.lookSensitivity
        controls.pitch -= event.movementY * controls.lookSensitivity
        const limit = Math.PI / 2 - 0.05
        controls.pitch = Math.max(-limit, Math.min(limit, controls.pitch))
      }
    }

    function handleMouseDown(event: MouseEvent) {
      if (worldRef.current.phase === "space") {
        if (controlModeRef.current === "touch") {
          cameraControlsRef.current.isDragging = true
          cameraControlsRef.current.previousMousePosition = { x: event.clientX, y: event.clientY }
        } else if (controlModeRef.current === "keyboard") {
          // Request pointer lock on click in keyboard mode
          if (!cameraControlsRef.current.pointerLocked && canvasRef.current) {
            canvasRef.current.requestPointerLock()
          }
        }
      }
    }

    function handleMouseUp() {
      cameraControlsRef.current.isDragging = false
    }

    function handlePointerLockChange() {
      cameraControlsRef.current.pointerLocked = document.pointerLockElement === canvasRef.current
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (controlModeRef.current !== "keyboard") return
      if (worldRef.current.phase !== "space") return
      const controls = cameraControlsRef.current
      const k = controls.keys
      switch (event.code) {
        case "KeyW": k.w = true; break
        case "KeyA": k.a = true; break
        case "KeyS": k.s = true; break
        case "KeyD": k.d = true; break
        case "Space": k.space = true; event.preventDefault(); break
        case "ShiftLeft":
        case "ShiftRight": k.shift = true; break
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const controls = cameraControlsRef.current
      const k = controls.keys
      switch (event.code) {
        case "KeyW": k.w = false; break
        case "KeyA": k.a = false; break
        case "KeyS": k.s = false; break
        case "KeyD": k.d = false; break
        case "Space": k.space = false; break
        case "ShiftLeft":
        case "ShiftRight": k.shift = false; break
      }
    }

    function handleWheel(event: WheelEvent) {
      if (worldRef.current.phase === "space" && controlModeRef.current === "touch") {
        const controls = cameraControlsRef.current
        controls.cameraDistance += event.deltaY * 0.1
        controls.cameraDistance = Math.max(30, Math.min(400, controls.cameraDistance))
        event.preventDefault()
      }
    }

    function handleTouchStart(event: TouchEvent) {
      const controls = cameraControlsRef.current
      if (worldRef.current.phase === "space") {
        if (event.touches.length === 1) {
          controls.isDragging = true
          controls.previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY }
        } else if (event.touches.length === 2) {
          const dx = event.touches[0].clientX - event.touches[1].clientX
          const dy = event.touches[0].clientY - event.touches[1].clientY
          controls.touchStartDistance = Math.sqrt(dx * dx + dy * dy)
        }
      }
    }

    function handleTouchMove(event: TouchEvent) {
      const controls = cameraControlsRef.current
      if (worldRef.current.phase === "space") {
        if (event.touches.length === 2) {
          const dx = event.touches[0].clientX - event.touches[1].clientX
          const dy = event.touches[0].clientY - event.touches[1].clientY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const delta = controls.touchStartDistance - dist
          controls.cameraDistance += delta * 0.5
          controls.cameraDistance = Math.max(30, Math.min(400, controls.cameraDistance))
          controls.touchStartDistance = dist
        } else if (controls.isDragging && event.touches.length === 1) {
          const deltaX = event.touches[0].clientX - controls.previousMousePosition.x
          const deltaY = event.touches[0].clientY - controls.previousMousePosition.y

          controls.cameraRotation.x += deltaX * 0.008
          controls.cameraRotation.y += deltaY * 0.008
          controls.cameraRotation.y = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, controls.cameraRotation.y))

          controls.previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY }
        }
      }
    }

    function handleTouchEnd() {
      cameraControlsRef.current.isDragging = false
    }

    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    // Add event listeners
    canvasRef.current.addEventListener("pointerdown", handlePointerDown as EventListener)
    canvasRef.current.addEventListener("pointermove", handlePointerMove as EventListener)
    canvasRef.current.addEventListener("mousedown", handleMouseDown)
    canvasRef.current.addEventListener("mouseup", handleMouseUp)
    canvasRef.current.addEventListener("mouseleave", handleMouseUp)
    canvasRef.current.addEventListener("wheel", handleWheel, { passive: false })
    canvasRef.current.addEventListener("touchstart", handleTouchStart, { passive: true })
    canvasRef.current.addEventListener("touchmove", handleTouchMove, { passive: true })
    canvasRef.current.addEventListener("touchend", handleTouchEnd)
    window.addEventListener("resize", handleResize)
    // Keyboard + pointer lock listeners for FPS-style controls
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("pointerlockchange", handlePointerLockChange)

    // Update functions
    function updateLaunchEffects(launchProgress: number, intensity: number) {
      if (!launchEffectsRef.current || !rocketRef.current) return

      const effects = launchEffectsRef.current.userData
      const particles = effects.particles as THREE.Mesh[]
      const activeParticles = Math.floor(effects.particleCount * Math.min(1, intensity * 5))

      for (let i = 0; i < effects.particleCount; i++) {
        const particle = particles[i]

        if (i < activeParticles) {
          particle.visible = true

          const baseX = (Math.random() - 0.5) * 3.5
          const baseY = rocketRef.current.position.y - 3 + Math.random() * 1
          const baseZ = (Math.random() - 0.5) * 3.5

          const age = Math.random()
          const riseSpeed = 4 + Math.random() * 6
          const spreadY = age * riseSpeed

          particle.position.set(
            baseX + (Math.random() - 0.5) * spreadY * 0.5,
            baseY + spreadY,
            baseZ + (Math.random() - 0.5) * spreadY * 0.5
          )

          const userData = particle.userData
          const ageOpacity = Math.max(0, 1 - age * 1.5)
          const sizeScale = Math.max(0.3, 1 - age * 0.8)

          particle.scale.setScalar(sizeScale)
          const mat = particle.material as THREE.MeshBasicMaterial
          mat.opacity = userData.maxOpacity * ageOpacity

          if (launchProgress > 0.75) {
            mat.opacity *= (1 - (launchProgress - 0.75) / 0.25)
          }
        } else {
          particle.visible = false
        }
      }
    }

    // Animation loop
    function animate() {
      requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const elapsed = clock.elapsedTime

      const world = worldRef.current
      const controls = cameraControlsRef.current

      // Phase: Intro - Camera moves TOWARDS THE CABIN (top of rocket)
      if (world.phase === "intro") {
        const introTime = (performance.now() / 1000) - world.introStartTime
        const introDuration = 4.0

        if (introTime >= introDuration) {
          world.introComplete = true
          setPhase("cabin")
        } else {
          const introProgress = introTime / introDuration

          // Smooth easing for more cinematic feel
          const easedProgress = 1 - Math.pow(1 - introProgress, 3)

          // Start position: outside looking at rocket
          // End position: near the cabin/nose of rocket (height ~13-14)
          const startRadius = 28
          const startHeight = 10
          const startLookY = 8

          // End near the cabin entrance (top part of rocket)
          const endRadius = 2.5
          const endHeight = 13  // Near the nose/cabin
          const endLookY = 14   // Looking at the cabin area

          const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, easedProgress)
          const currentHeight = THREE.MathUtils.lerp(startHeight, endHeight, easedProgress)
          const currentLookY = THREE.MathUtils.lerp(startLookY, endLookY, easedProgress)

          // Gentle orbit during approach
          world.orbitAngle += delta * 0.12 * (1 - easedProgress * 0.8)

          const camX = Math.cos(world.orbitAngle) * currentRadius
          const camZ = Math.sin(world.orbitAngle) * currentRadius
          const camY = currentHeight + Math.sin(elapsed * 0.6) * 0.08 * (1 - easedProgress)

          camera.position.set(camX, camY, camZ)

          // Look at cabin area (top of rocket)
          camera.lookAt(0, currentLookY, 0)

          // Zoom in effect
          const targetFov = THREE.MathUtils.lerp(65, 50, easedProgress)
          camera.fov = targetFov
          camera.updateProjectionMatrix()

          // Subtle rocket animation
          rocket.position.y = 1 + Math.sin(elapsed * 0.8) * 0.03
          rocket.rotation.y = Math.sin(elapsed * 0.25) * 0.01
          accentBody.emissiveIntensity = 0.2 + easedProgress * 0.3
        }
      }
      // Phase: Countdown
      else if (world.phase === "countdown") {
        const countdownTime = (performance.now() / 1000) - world.countdownStartTime
        const countdownDuration = 3

        if (countdownTime >= countdownDuration) {
          setPhase("launching")
        } else {
          rocket.visible = true
          rocket.position.y = 1

          const distance = 20
          const height = 8
          const angle = elapsed * 0.15

          camera.position.set(
            Math.cos(angle) * distance,
            height + Math.sin(countdownTime * Math.PI * 2 / countdownDuration) * 0.5,
            Math.sin(angle) * distance + 3
          )
          camera.lookAt(0, 3, 0)

          setSpeedValue(Math.round(countdownTime * 10))
          setAltValue(1)
          const remaining = Math.ceil(countdownDuration - countdownTime)
          setTimeValue("0" + remaining)
        }
      }
      // Phase: Launching
      else if (world.phase === "launching") {
        const launchTime = (performance.now() / 1000) - world.launchStartTime
        const launchDuration = 5

        if (launchTime >= launchDuration) {
          world.spaceEntered = true

          // Create solar system when entering space
          if (!solarSystemRef.current) {
            solarSystemRef.current = createSolarSystem()
            asteroidBeltRef.current = createAsteroidBelt()
            starfieldRef.current = createSpaceStarfield()

            controls.spaceTargetPosition.set(120, 30, 120)
            controls.cameraRotation = { x: 0, y: 0 }
            controls.targetCameraRotation = { x: 0, y: 0 }
            controls.cameraDistance = 120
            controls.targetDistance = 120
          }

          setPhase("space")
        } else {
          const launchProgress = launchTime / launchDuration

          rocket.position.y = 1 + launchProgress * 180
          rocket.rotation.x = Math.sin(launchProgress * Math.PI * 4) * 0.015
          rocket.visible = true

          const distance = 12 + launchProgress * 6
          const height = 3 + launchProgress * 6
          const angle = elapsed * 0.12

          camera.position.set(
            Math.cos(angle) * distance,
            height + Math.sin(launchProgress * Math.PI * 2) * 0.3,
            Math.sin(angle) * distance + 5
          )
          camera.lookAt(0, rocket.position.y, 0)

          camera.fov = 70 - launchProgress * 10
          camera.updateProjectionMatrix()

          world.currentSpeed = Math.round(launchProgress * 2800)
          world.currentAlt = Math.round(rocket.position.y * 100)

          updateLaunchEffects(launchProgress, 0.35)

          setSpeedValue(world.currentSpeed)
          setAltValue(world.currentAlt)
          const secs = Math.floor(launchTime)
          setTimeValue(String(secs).padStart(2, "0") + ":" + String(Math.floor((launchTime % 1) * 60)).padStart(2, "0"))
        }
      }
      // Phase: Space
      else if (world.phase === "space") {
        // Update camera controls
        controls.targetCameraRotation.x += (controls.cameraRotation.x - controls.targetCameraRotation.x) * 0.08
        controls.targetCameraRotation.y += (controls.cameraRotation.y - controls.targetCameraRotation.y) * 0.08
        controls.targetDistance += (controls.cameraDistance - controls.targetDistance) * 0.08

        camera.position.lerp(controls.spaceTargetPosition, 0.08)

        const theta = controls.targetCameraRotation.x
        const phi = Math.max(0.1, Math.min(Math.PI - 0.1, Math.PI / 2 + controls.targetCameraRotation.y))

        const lookX = camera.position.x + controls.targetDistance * Math.sin(phi) * Math.cos(theta)
        const lookY = camera.position.y + controls.targetDistance * Math.cos(phi)
        const lookZ = camera.position.z + controls.targetDistance * Math.sin(phi) * Math.sin(theta)

        camera.lookAt(lookX, lookY, lookZ)

        // Update planets
        planetsRef.current.forEach((planetGroup) => {
          const data = planetGroup.userData
          data.angle += data.speed * delta
          data.orbitAngle = data.angle

          planetGroup.position.set(
            Math.cos(data.angle) * data.distance,
            0,
            Math.sin(data.angle) * data.distance
          )

          planetGroup.children[0].rotation.y += data.rotationSpeed
        })

        // Update asteroids
        if (asteroidBeltRef.current) {
          asteroidBeltRef.current.children.forEach((asteroid) => {
            const data = asteroid.userData
            data.orbitAngle += 0.0003 * delta
            asteroid.position.x = Math.cos(data.orbitAngle) * data.orbitDistance
            asteroid.position.z = Math.sin(data.orbitAngle) * data.orbitDistance
            asteroid.rotation.x += data.rotationSpeed.x
            asteroid.rotation.y += data.rotationSpeed.y
            asteroid.rotation.z += data.rotationSpeed.z
          })
        }

        // Update starfield
        if (starfieldRef.current && starfieldRef.current.children[0]) {
          starfieldRef.current.children[0].rotation.y += delta * 0.01
          starfieldRef.current.children[0].rotation.x += delta * 0.005
        }

        rocket.position.y = 200
        rocket.visible = false
      }
      // Normal phases: Menu, Launchpad
      else {
        let orbitTargetRadius = 34
        let orbitTargetHeight = 13
        // Constant slow rotation speed for both menu and launchpad
        const orbitSpeed = 0.05

        if (world.phase === "launchpad") {
          orbitTargetRadius = 30
          orbitTargetHeight = 12
        }

        world.orbitRadius = THREE.MathUtils.lerp(world.orbitRadius, orbitTargetRadius, 0.03)
        world.orbitHeight = THREE.MathUtils.lerp(world.orbitHeight, orbitTargetHeight, 0.03)
        // Use raw delta to ensure constant angular speed regardless of framerate
        world.orbitAngle += delta * orbitSpeed

        const camX = Math.cos(world.orbitAngle) * world.orbitRadius
        const camZ = Math.sin(world.orbitAngle) * world.orbitRadius
        const camY = world.orbitHeight + Math.sin(elapsed * 0.5) * 0.15
        camera.position.set(camX, camY, camZ)
        camera.fov = 75
        camera.updateProjectionMatrix()
        camera.lookAt(0, 7, 0)

        if (rocket.visible) {
          rocket.position.y = 1 + Math.sin(elapsed * 1.14) * 0.08
          rocket.rotation.y = Math.sin(elapsed * 0.32) * 0.035
          accentBody.emissiveIntensity = world.isRocketHovered ? 0.45 : 0.1
        }
      }

      // Ambient animations
      if (stars) stars.rotation.y += performanceMode ? 0.000025 : 0.000045
      if (clouds) clouds.rotation.y += performanceMode ? 0.00018 : 0.00035
      if (world.phase !== "cabin" && skyDome) {
        skyDome.rotation.y += performanceMode ? 0.000015 : 0.00003
      }

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      renderer.dispose()
      scene.clear()
      canvasRef.current?.removeEventListener("pointerdown", handlePointerDown as EventListener)
      canvasRef.current?.removeEventListener("pointermove", handlePointerMove as EventListener)
      canvasRef.current?.removeEventListener("mousedown", handleMouseDown)
      canvasRef.current?.removeEventListener("mouseup", handleMouseUp)
      canvasRef.current?.removeEventListener("mouseleave", handleMouseUp)
      canvasRef.current?.removeEventListener("wheel", handleWheel)
      canvasRef.current?.removeEventListener("touchstart", handleTouchStart)
      canvasRef.current?.removeEventListener("touchmove", handleTouchMove)
      canvasRef.current?.removeEventListener("touchend", handleTouchEnd)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("pointerlockchange", handlePointerLockChange)
    }
  }, [setPhase])

  const handlePlay = useCallback(() => {
    setPhase("launchpad")
  }, [setPhase])

  const handleLaunch = useCallback(() => {
    if (phase === "cabin") {
      setPhase("countdown")
    }
  }, [phase, setPhase])

  return (
    <div id="game-container">
      <canvas ref={canvasRef} id="canvas3d" />

      {/* Main Menu */}
      <div id="ui-main-menu" className={`ui-panel ${phase === "menu" ? "active" : ""}`}>
        <button
          className="btn-settings"
          onClick={() => setShowSettings(true)}
          aria-label="Ajustes"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <div className="title-wrap">
          <p className="eyebrow">Fira Tecnològica - Educación Infantil</p>
          <h1 className="game-title">Misión: Viaje al Sistema Solar</h1>
          <p className="subtitle">Exploración espacial interactiva con enfoque pedagógico</p>
        </div>
        <div className="bottom-controls">
          <button className="btn-play" onClick={handlePlay}>Jugar</button>
          <p className="creators">Creadores: Arnau, Àlex Félix, Arturo</p>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Ajustes</h2>
              <button
                className="btn-close"
                onClick={() => setShowSettings(false)}
                aria-label="Cerrar"
                type="button"
              >
                {"\u00D7"}
              </button>
            </div>
            <div className="settings-body">
              <div className="settings-group">
                <h3>Modo de control (exploración espacial)</h3>
                <p className="settings-desc">
                  Elige cómo moverte por el espacio. Usa {'"'}Pantalla táctil{'"'} en la pizarra digital del aula.
                </p>
                <div className="control-mode-options">
                  <button
                    className={`control-mode-btn ${controlMode === "keyboard" ? "active" : ""}`}
                    onClick={() => setControlMode("keyboard")}
                    type="button"
                  >
                    <div className="mode-icon" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="20" height="12" rx="2"/>
                        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
                      </svg>
                    </div>
                    <div className="mode-label">Teclado y Ratón</div>
                    <div className="mode-detail">WASD + ratón</div>
                  </button>

                  <button
                    className={`control-mode-btn ${controlMode === "touch" ? "active" : ""}`}
                    onClick={() => setControlMode("touch")}
                    type="button"
                  >
                    <div className="mode-icon" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11V6a3 3 0 0 1 6 0v5"/>
                        <path d="M9 11v3a3 3 0 1 0 6 0v-3"/>
                        <path d="M6 14v-3a3 3 0 0 1 6 0"/>
                        <path d="M6 14a3 3 0 1 0 6 0"/>
                      </svg>
                    </div>
                    <div className="mode-label">Pantalla táctil</div>
                    <div className="mode-detail">Arrastrar y pellizcar</div>
                  </button>
                </div>
                {controlMode === "keyboard" && (
                  <div className="mode-help">
                    <strong>Controles:</strong>
                    <ul>
                      <li><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> - Moverse</li>
                      <li><kbd>Espacio</kbd> - Subir</li>
                      <li><kbd>Shift</kbd> - Bajar</li>
                      <li>Ratón - Mirar alrededor (clic para capturar)</li>
                      <li><kbd>Esc</kbd> - Liberar ratón</li>
                      <li>Clic en planeta - Ver información</li>
                    </ul>
                  </div>
                )}
                {controlMode === "touch" && (
                  <div className="mode-help">
                    <strong>Controles:</strong>
                    <ul>
                      <li>Arrastrar - Mirar alrededor</li>
                      <li>Pellizcar - Acercar/Alejar</li>
                      <li>Tocar planeta - Ver información</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Launch HUD */}
      <div id="ui-launch-hud" className={`ui-panel ${phase === "launchpad" || phase === "intro" || phase === "countdown" || phase === "launching" ? "active" : ""}`}>
        <div className="hud-card">
          <p className="hud-title">Zona de lanzamiento activa</p>
          <p className={`hud-status ${isAlert ? "alert" : ""}`}>{hudStatus}</p>
        </div>
      </div>

      {/* Cabin - Cartoon style blue cockpit */}
      <div id="ui-cabin" className={`ui-panel ${phase === "cabin" ? "active" : ""}`}>
        {/* Window at the top showing the sky/space */}
        <div className="cockpit-window">
          <div className="cockpit-sky">
            <div className="cockpit-stars"></div>
          </div>
          <div className="window-frame-cartoon"></div>
        </div>

        {/* Main curved blue control panel */}
        <div className="cockpit-panel-cartoon">
          {/* Side consoles */}
          <div className="side-screen left-screen">
            <div className="mini-display">
              <div className="mini-display-line">VEL</div>
              <div className="mini-display-value">{speedValue}</div>
              <div className="mini-display-unit">km/h</div>
            </div>
            <div className="side-buttons-grid">
              <span className="side-btn on"></span>
              <span className="side-btn"></span>
              <span className="side-btn on"></span>
              <span className="side-btn warning"></span>
            </div>
          </div>

          <div className="side-screen right-screen">
            <div className="mini-display">
              <div className="mini-display-line">ALT</div>
              <div className="mini-display-value">{altValue}</div>
              <div className="mini-display-unit">m</div>
            </div>
            <div className="side-buttons-grid">
              <span className="side-btn on"></span>
              <span className="side-btn on"></span>
              <span className="side-btn"></span>
              <span className="side-btn on"></span>
            </div>
          </div>

          {/* Left controls row */}
          <div className="controls-row-left">
            <div className="control-cluster">
              <div className="cluster-label">SISTEMA</div>
              <div className="button-row">
                <span className="round-btn green"></span>
                <span className="round-btn green"></span>
                <span className="round-btn yellow"></span>
                <span className="round-btn red"></span>
              </div>
              <div className="button-row">
                <span className="round-btn blue"></span>
                <span className="round-btn green"></span>
                <span className="round-btn yellow"></span>
                <span className="round-btn blue"></span>
              </div>
            </div>
            <div className="dial-group">
              <div className="cartoon-dial">
                <div className="dial-needle" style={{ transform: "rotate(45deg)" }}></div>
              </div>
              <div className="cartoon-dial">
                <div className="dial-needle" style={{ transform: "rotate(-30deg)" }}></div>
              </div>
            </div>
          </div>

          {/* Central big red launch button area */}
          <div className="central-control">
            <div className="central-display">
              <div className="central-time">T: {timeValue}</div>
              <div className="central-status">
                <span className="status-dot on"></span>
                <span>LISTO</span>
              </div>
            </div>
            <div className="launch-button-wrapper">
              <div className="launch-hazard"></div>
              <button
                className="big-launch-button"
                onClick={handleLaunch}
                type="button"
              >
                <span className="launch-button-inner">
                  <span className="launch-label">DESPEGAR</span>
                </span>
              </button>
            </div>
          </div>

          {/* Right controls row */}
          <div className="controls-row-right">
            <div className="lever-group">
              <div className="lever-item">
                <div className="lever-track">
                  <div className="lever-handle" style={{ top: "20%" }}></div>
                </div>
                <div className="lever-label">PWR</div>
              </div>
              <div className="lever-item">
                <div className="lever-track">
                  <div className="lever-handle" style={{ top: "55%" }}></div>
                </div>
                <div className="lever-label">NAV</div>
              </div>
            </div>
            <div className="control-cluster">
              <div className="cluster-label">MOTOR</div>
              <div className="button-row">
                <span className="round-btn green"></span>
                <span className="round-btn yellow"></span>
                <span className="round-btn green"></span>
                <span className="round-btn red"></span>
              </div>
              <div className="button-row">
                <span className="round-btn blue"></span>
                <span className="round-btn blue"></span>
                <span className="round-btn green"></span>
                <span className="round-btn yellow"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Space HUD */}
      <div id="ui-space-hud" className={`ui-panel ${phase === "space" ? "active" : ""}`}>
        <div className="space-hud-top">
          <div className="space-card">
            <p className="space-title">EXPLORACIÓN ESPACIAL</p>
            <p className="space-hint">Arrastra para mirar | Pellizca para zoom | Toca un planeta</p>
          </div>
        </div>
        <div className="space-hud-bottom">
          {planetInfo && (
            <div className="planet-info">
              <p className="planet-name">{planetInfo.name}</p>
              <p className="planet-desc">{planetInfo.description}</p>
              <div className="planet-stats">
                <span>🌡️ {planetInfo.temperature}</span>
                <span>📏 {planetInfo.diameter}</span>
                <span>🌙 {typeof planetInfo.moons === 'number' ? `${planetInfo.moons} lunas` : planetInfo.moons}</span>
              </div>
              <p className="planet-fact">💡 {planetInfo.fact}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
