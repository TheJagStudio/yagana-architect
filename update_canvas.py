import re

with open('src/components/KundCanvas.tsx', 'r') as f:
    content = f.read()

start_marker = "{/* Ground / Area bounds */}"
end_marker = "{/* Active Drawing */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found")
    exit(1)

new_content = """{/* Iterate over all yagnas */}
          {allYagnas.map((y) => {
            const offset = getGlobalOffset(y, yagna);
            const isCurrent = y.id === yagna.id;
            const polyPoints = getPolygonCanvasPoints(y, pxPerMeter)?.flat || [];
            
            return (
              <Group key={y.id} x={offset.x} y={offset.y} opacity={isCurrent ? 1 : 0.85}>
                {/* Ground / Area bounds */}
                {polyPoints.length >= 6 ? (
                  <Line
                    name="ground"
                    points={polyPoints}
                    fill={mapStyle !== 'none' ? "rgba(251, 191, 36, 0.12)" : "#e2e8f0"}
                    stroke={isCurrent && isGroundDraggable ? "#3b82f6" : (mapStyle !== 'none' ? "#f59e0b" : "#cbd5e1")}
                    strokeWidth={isCurrent && isGroundDraggable ? 4 : (mapStyle !== 'none' ? 3 : 2)}
                    dash={isCurrent && isGroundDraggable ? [10, 5] : (mapStyle === 'satellite' ? [8, 5] : undefined)}
                    opacity={y.settings.groundOpacity !== undefined ? y.settings.groundOpacity : 1.0}
                    closed={true}
                    draggable={isCurrent && isGroundDraggable}
                    onDragEnd={isCurrent ? handleGroundDragEnd : undefined}
                    onMouseEnter={(e) => {
                      if (isCurrent && isGroundDraggable) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onClick={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                    onTap={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                  />
                ) : (
                  <Rect
                    name="ground"
                    x={-(y.dimensions.width * pxPerMeter) / 2}
                    y={-(y.dimensions.height * pxPerMeter) / 2}
                    width={y.dimensions.width * pxPerMeter}
                    height={y.dimensions.height * pxPerMeter}
                    fill={mapStyle !== 'none' ? "rgba(251, 191, 36, 0.12)" : "#e2e8f0"}
                    stroke={isCurrent && isGroundDraggable ? "#3b82f6" : (mapStyle !== 'none' ? "#f59e0b" : "#cbd5e1")}
                    strokeWidth={isCurrent && isGroundDraggable ? 4 : (mapStyle !== 'none' ? 3 : 2)}
                    dash={isCurrent && isGroundDraggable ? [10, 5] : (mapStyle === 'satellite' ? [8, 5] : undefined)}
                    opacity={y.settings.groundOpacity !== undefined ? y.settings.groundOpacity : 1.0}
                    draggable={isCurrent && isGroundDraggable}
                    onDragEnd={isCurrent ? handleGroundDragEnd : undefined}
                    onMouseEnter={(e) => {
                      if (isCurrent && isGroundDraggable) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onClick={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                    onTap={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                  />
                )}
                
                {y.kunds.map((kund) => {
                  const currentSize = (kund.size || y.settings.kundSize) * pxPerMeter;
                  const seatsCount = kund.seats || y.settings.sitsPerKund;
                  const isSelected = selectedKundId === kund.id || selectedKundIds.includes(kund.id);
                  
                  const kundColor = y.settings.kundColor || '#fcd34d';
                  const kundInnerColor = y.settings.kundInnerColor || '#f59e0b';
                  const seatColor = y.settings.seatColor || '#94a3b8';
                  const sWidth = (y.settings.seatWidth || 0.4) * pxPerMeter;
                  const sHeight = (y.settings.seatHeight || 0.4) * pxPerMeter;
                  const sOffset = (y.settings.seatOffset !== undefined ? y.settings.seatOffset : 0.3) * pxPerMeter;
                  const seatLayout = y.settings.seatLayout || 'circular';
                  const accessories = y.settings.kundAccessories || [];

                  const seatPositions: Array<{ x: number, y: number, rotation: number, color?: string }> = [];
                  if (y.settings.individualSeats && y.settings.individualSeats.length > 0) {
                    y.settings.individualSeats.forEach(seat => {
                      seatPositions.push({
                        x: seat.offsetX * pxPerMeter,
                        y: seat.offsetY * pxPerMeter,
                        rotation: seat.rotation,
                        color: seat.color
                      });
                    });
                  } else {
                    if (seatLayout === 'square') {
                      const sides: Array<any[]> = [[], [], [], []];
                      for (let i = 0; i < seatsCount; i++) {
                        sides[i % 4].push({});
                      }
                      sides[0].forEach((_, idx) => {
                        const count = sides[0].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const yOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const xOffset = -(currentSize / 2 + sOffset + sWidth / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 0 });
                      });
                      sides[1].forEach((_, idx) => {
                        const count = sides[1].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const yOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const xOffset = (currentSize / 2 + sOffset + sWidth / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 180 });
                      });
                      sides[2].forEach((_, idx) => {
                        const count = sides[2].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const xOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const yOffset = -(currentSize / 2 + sOffset + sHeight / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 90 });
                      });
                      sides[3].forEach((_, idx) => {
                        const count = sides[3].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const xOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const yOffset = (currentSize / 2 + sOffset + sHeight / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 270 });
                      });
                    } else {
                      const radius = (currentSize / 2) + sOffset + (Math.max(sWidth, sHeight) / 2);
                      for (let i = 0; i < seatsCount; i++) {
                        const angle = (i * (360 / seatsCount)) * (Math.PI / 180);
                        const cx = Math.cos(angle) * radius;
                        const cy = Math.sin(angle) * radius;
                        seatPositions.push({
                          x: cx,
                          y: cy,
                          rotation: (i * (360 / seatsCount)) + 90
                        });
                      }
                    }
                  }

                  return (
                    <Group
                      key={kund.id}
                      x={kund.x}
                      y={kund.y}
                      rotation={kund.rotation}
                      draggable={isCurrent && mode !== 'draw'}
                      onDragEnd={(e) => isCurrent ? handleDragEnd(e, kund.id) : undefined}
                      onClick={(e) => {
                        if (!isCurrent) return;
                        if (mode === 'select' && e.evt.shiftKey) {
                          setSelectedKundIds(prev => prev.includes(kund.id) ? prev.filter(id => id !== kund.id) : [...prev, kund.id]);
                        } else if (mode === 'select') {
                          setSelectedKundIds([kund.id]);
                        } else {
                          setSelectedKundId(kund.id);
                        }
                      }}
                    >
                      {seatPositions.map((pos, i) => (
                        <Group key={`seat-${i}`} x={pos.x} y={pos.y} rotation={pos.rotation}>
                          <Rect
                            x={-sWidth / 2}
                            y={-sHeight / 2}
                            width={sWidth}
                            height={sHeight}
                            fill={pos.color || seatColor}
                            stroke="#475569"
                            strokeWidth={1}
                            cornerRadius={2}
                          />
                          <Rect
                            x={-sWidth / 2}
                            y={-sHeight / 2}
                            width={sWidth * 0.15}
                            height={sHeight}
                            fill="#475569"
                            opacity={0.6}
                            cornerRadius={1}
                          />
                        </Group>
                      ))}

                      <Rect
                        x={-currentSize / 2}
                        y={-currentSize / 2}
                        width={currentSize}
                        height={currentSize}
                        fill={isSelected ? "#fbbf24" : kundColor}
                        stroke={isSelected ? "#ea580c" : "#b45309"}
                        strokeWidth={isSelected ? 3 : 2}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.2}
                      />
                      
                      <Rect
                        x={-currentSize / 3}
                        y={-currentSize / 3}
                        width={currentSize * (2/3)}
                        height={currentSize * (2/3)}
                        fill={kundInnerColor}
                        stroke="#b45309"
                        strokeWidth={1}
                      />

                      {accessories.map((acc) => {
                        const ax = acc.offsetX * pxPerMeter;
                        const ay = acc.offsetY * pxPerMeter;
                        const aw = acc.width * pxPerMeter;
                        const ah = acc.height * pxPerMeter;

                        if (acc.type === 'circle') {
                          return (
                            <Circle
                              key={acc.id}
                              x={ax}
                              y={ay}
                              radius={aw / 2}
                              fill={acc.color}
                              stroke="#475569"
                              strokeWidth={0.5}
                            />
                          );
                        } else if (acc.type === 'text') {
                          return (
                            <Text
                              key={acc.id}
                              x={ax - aw / 2}
                              y={ay - ah / 2}
                              width={aw}
                              height={ah}
                              text={acc.name}
                              fontSize={8}
                              align="center"
                              verticalAlign="middle"
                              fill={acc.color}
                              fontStyle="bold"
                            />
                          );
                        } else {
                          return (
                            <Rect
                              key={acc.id}
                              x={ax - aw / 2}
                              y={ay - ah / 2}
                              width={aw}
                              height={ah}
                              fill={acc.color}
                              stroke="#475569"
                              strokeWidth={0.5}
                              cornerRadius={1}
                            />
                          );
                        }
                      })}

                      <Text
                        text={kund.number.toString()}
                        fontSize={currentSize * 0.3}
                        fontStyle="bold"
                        fill="#78350f"
                        align="center"
                        verticalAlign="middle"
                        width={currentSize}
                        height={currentSize}
                        x={-currentSize / 2}
                        y={-currentSize / 2}
                      />
                    </Group>
                  );
                })}
                
                {(y.objects || []).map((obj) => (
                  <Group
                    key={obj.id}
                    x={obj.x}
                    y={obj.y}
                    rotation={obj.rotation}
                    draggable={isCurrent && mode !== 'draw' && !(isEditingPoints && selectedObjectId === obj.id)}
                    onDragEnd={(e) => isCurrent ? handleObjectDragEnd(e, obj.id) : undefined}
                    onTransformEnd={(e) => isCurrent ? handleObjectTransform(e, obj.id) : undefined}
                    onClick={(e) => {
                      if (!isCurrent) return;
                      e.cancelBubble = true;
                      setSelectedKundId(null);
                      setSelectedKundIds([]);
                      setSelectedObjectId(obj.id);
                    }}
                    onTap={(e) => {
                      if (!isCurrent) return;
                      e.cancelBubble = true;
                      setSelectedKundId(null);
                      setSelectedKundIds([]);
                      setSelectedObjectId(obj.id);
                    }}
                  >
                    {obj.points && obj.points.length >= 6 ? (
                      <Line
                        points={obj.points}
                        fill={obj.color || '#ec4899'}
                        stroke={selectedObjectId === obj.id ? "#fbbf24" : "#be185d"}
                        strokeWidth={selectedObjectId === obj.id ? 4 : 2}
                        opacity={0.8}
                        closed={true}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.2}
                      />
                    ) : (
                      <Rect
                        x={0}
                        y={0}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color || '#ec4899'}
                        stroke={selectedObjectId === obj.id ? "#fbbf24" : "#be185d"}
                        strokeWidth={selectedObjectId === obj.id ? 4 : 2}
                        opacity={0.8}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.2}
                      />
                    )}
                    {obj.points && obj.points.length >= 6 ? (
                      (() => {
                        let sumX = 0;
                        let sumY = 0;
                        let ptCount = 0;
                        for (let i = 0; i < obj.points.length; i += 2) {
                          sumX += obj.points[i];
                          sumY += obj.points[i+1];
                          ptCount++;
                        }
                        const avgX = ptCount > 0 ? sumX / ptCount : 0;
                        const avgY = ptCount > 0 ? sumY / ptCount : 0;
                        return (
                          <Text
                            text={obj.name}
                            fontSize={13}
                            fontStyle="bold"
                            fill="#ffffff"
                            align="center"
                            verticalAlign="middle"
                            x={avgX - 100}
                            y={avgY - 10}
                            width={200}
                            height={20}
                          />
                        );
                      })()
                    ) : (
                      <Text
                        text={obj.name}
                        fontSize={Math.min(obj.width || 100, obj.height || 100) * 0.3}
                        fontStyle="bold"
                        fill="#ffffff"
                        align="center"
                        verticalAlign="middle"
                        width={obj.width || 100}
                        height={obj.height || 100}
                        x={0}
                        y={0}
                      />
                    )}

                    {obj.points && isCurrent && isEditingPoints && selectedObjectId === obj.id && (
                      <Group>
                        {Array.from({ length: obj.points.length / 2 }).map((_, idx) => {
                          const xIdx = idx * 2;
                          const yIdx = idx * 2 + 1;
                          const px = obj.points![xIdx];
                          const py = obj.points![yIdx];
                          return (
                            <Circle
                              key={`ctrl-pt-${idx}`}
                              x={px}
                              y={py}
                              radius={7}
                              fill="#ffffff"
                              stroke="#2563eb"
                              strokeWidth={2.5}
                              shadowColor="black"
                              shadowBlur={3}
                              shadowOpacity={0.3}
                              draggable
                              onDragMove={(e) => {
                                e.cancelBubble = true;
                                const newX = e.target.x();
                                const newY = e.target.y();
                                
                                const points = [...obj.points!];
                                points[xIdx] = newX;
                                points[yIdx] = newY;
                                
                                const updated = y.objects.map(o => 
                                  o.id === obj.id ? { ...o, points } : o
                                );
                                updateObjects(y.id, updated);
                              }}
                              onDragEnd={(e) => {
                                e.cancelBubble = true;
                              }}
                              onMouseEnter={(e) => {
                                const stage = e.target.getStage();
                                if (stage) stage.container().style.cursor = 'move';
                              }}
                              onMouseLeave={(e) => {
                                const stage = e.target.getStage();
                                if (stage) stage.container().style.cursor = 'default';
                              }}
                            />
                          );
                        })}
                      </Group>
                    )}
                  </Group>
                ))}
              </Group>
            );
          })}

          {/* Active Drawing */}"""

result = content[:start_idx] + new_content + content[end_idx + len(end_marker):]

with open('src/components/KundCanvas.tsx', 'w') as f:
    f.write(result)

print("Updated successfully")
